import type {
  AbCorr,
  DlaDescriptor,
  Found,
  IluminResult,
  KernelData,
  KernelInfo,
  KernelKind,
  KernelKindInput,
  KernelSource,
  KernelPoolVarType,
  SpiceBackend,
  SpiceHandle,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceStateVector,
  SpiceVector3,
  SpkposResult,
  SpkezrResult,
  SubPointResult,
} from "@rybosome/tspice-backend-contract";
import {
  assertGetmsgWhich,
  assertSpiceInt32,
  brandMat3RowMajor,
} from "@rybosome/tspice-backend-contract";

/**
 * A deterministic, pure-TS "toy" backend.
 *
 * This backend exists for:
 * - tests
 * - demos (e.g. viewer smoke tests)
 * - environments where native + WASM backends are unavailable
 *
 * It is intentionally **not** a physically-accurate ephemeris.
 *
 * Time conversion notes:
 * - `str2et` supports ISO-8601 / RFC3339-style UTC timestamps only.
 * - Leap seconds are ignored.
 * - The J2000 epoch is treated as `2000-01-01T12:00:00Z`.
 */

const TWO_PI = Math.PI * 2;

export const FAKE_SPICE_VERSION = "tspice-fake-backend@0.0.0";

const J2000_UTC_MS = Date.parse("2000-01-01T12:00:00.000Z");

const BODY_IDS = {
  SUN: 10,
  EARTH: 399,
  MOON: 301,
} as const;

type SupportedBodyName = keyof typeof BODY_IDS;

type BodyMeta = {
  id: number;
  name: SupportedBodyName;
  meanRadiusKm: number;
};

const BODY_META: readonly BodyMeta[] = [
  { id: BODY_IDS.SUN, name: "SUN", meanRadiusKm: 695_700 },
  { id: BODY_IDS.EARTH, name: "EARTH", meanRadiusKm: 6_371 },
  { id: BODY_IDS.MOON, name: "MOON", meanRadiusKm: 1_737.4 },
];

const ID_TO_BODY = new Map<number, BodyMeta>(BODY_META.map((b) => [b.id, b]));
const NAME_TO_ID = new Map<string, number>(
  BODY_META.flatMap((b) => [
    [b.name, b.id],
    [b.name.toLowerCase(), b.id],
  ]),
);

const FRAME_CODES = {
  J2000: 1,
  IAU_EARTH: 10013,
  IAU_MOON: 10020,
} as const;

type SupportedFrameName = keyof typeof FRAME_CODES;

const FRAME_NAME_TO_CODE = new Map<string, number>([
  ["J2000", FRAME_CODES.J2000],
  ["j2000", FRAME_CODES.J2000],
  ["IAU_EARTH", FRAME_CODES.IAU_EARTH],
  ["iau_earth", FRAME_CODES.IAU_EARTH],
  ["IAU_MOON", FRAME_CODES.IAU_MOON],
  ["iau_moon", FRAME_CODES.IAU_MOON],
]);

const FRAME_CODE_TO_NAME = new Map<number, SupportedFrameName>([
  [FRAME_CODES.J2000, "J2000"],
  [FRAME_CODES.IAU_EARTH, "IAU_EARTH"],
  [FRAME_CODES.IAU_MOON, "IAU_MOON"],
]);

/**
 * Frame spin rates (rad/s) relative to J2000.
 *
 * Used for deterministic `pxform`/`sxform`. These are not intended to be
 * authoritative values.
 */
const FRAME_SPIN_RATE_RAD_PER_SEC: Record<SupportedFrameName, number> = {
  J2000: 0,
  // Approx sidereal rotation (deterministic constant).
  IAU_EARTH: TWO_PI / 86164.0905,
  // Approx synchronous rotation with orbital period (deterministic constant).
  IAU_MOON: TWO_PI / (27.321661 * 24 * 60 * 60),
};

function normalizeName(name: string): string {
  return name.trim();
}

function parseBodyRef(ref: string): number {
  const trimmed = normalizeName(ref);

  // Accept numeric IDs as strings.
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const id = NAME_TO_ID.get(trimmed) ?? NAME_TO_ID.get(trimmed.toLowerCase());
  if (id === undefined) {
    throw new Error(`Fake backend: unsupported body: ${JSON.stringify(ref)}`);
  }
  return id;
}

function parseFrameName(ref: string): SupportedFrameName {
  const trimmed = normalizeName(ref);
  const code = FRAME_NAME_TO_CODE.get(trimmed) ?? FRAME_NAME_TO_CODE.get(trimmed.toLowerCase());
  const name = code === undefined ? undefined : FRAME_CODE_TO_NAME.get(code);
  if (!name) {
    throw new Error(`Fake backend: unsupported frame: ${JSON.stringify(ref)}`);
  }
  return name;
}

function getBodyRadiusKm(bodyId: number): number {
  return ID_TO_BODY.get(bodyId)?.meanRadiusKm ?? 1;
}

function vadd(a: SpiceVector3, b: SpiceVector3): SpiceVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vsub(a: SpiceVector3, b: SpiceVector3): SpiceVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vscale(s: number, v: SpiceVector3): SpiceVector3 {
  return [s * v[0], s * v[1], s * v[2]];
}

function vdot(a: SpiceVector3, b: SpiceVector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vcrss(a: SpiceVector3, b: SpiceVector3): SpiceVector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vnorm(v: SpiceVector3): number {
  return Math.sqrt(vdot(v, v));
}

function vhat(v: SpiceVector3): SpiceVector3 {
  const n = vnorm(v);
  if (n === 0) return [0, 0, 0];
  return vscale(1 / n, v);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function angleBetween(a: SpiceVector3, b: SpiceVector3): number {
  const na = vnorm(a);
  const nb = vnorm(b);
  if (na === 0 || nb === 0) return 0;
  const c = clamp(vdot(a, b) / (na * nb), -1, 1);
  return Math.acos(c);
}

function canonicalizeZero(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}

function rotZRowMajor(theta: number): Mat3RowMajor {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return brandMat3RowMajor(
    [
      canonicalizeZero(c),
      canonicalizeZero(-s),
      0,
      canonicalizeZero(s),
      canonicalizeZero(c),
      0,
      0,
      0,
      1,
    ] as const,
    { label: "fake.rotZRowMajor" },
  );
}

function drotZRowMajor(theta: number, w: number): Mat3RowMajor {
  // d/dt rotZ(theta) = w * d/dtheta rotZ(theta)
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return brandMat3RowMajor(
    [
      canonicalizeZero(-w * s),
      canonicalizeZero(-w * c),
      0,
      canonicalizeZero(w * c),
      canonicalizeZero(-w * s),
      0,
      0,
      0,
      0,
    ] as const,
    { label: "fake.drotZRowMajor" },
  );
}

function mmul3(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor {
  // Row-major 3x3 multiply: out = a*b
  const out: number[] = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += a[r * 3 + k]! * b[k * 3 + c]!;
      }
      out[r * 3 + c] = sum;
    }
  }
  // Return a real tuple (and brand) instead of exposing a mutable `number[]`.
  return brandMat3RowMajor(
    [out[0]!, out[1]!, out[2]!, out[3]!, out[4]!, out[5]!, out[6]!, out[7]!, out[8]!] as const,
    {
      label: "fake.mmul3",
    },
  );
}


function rotateRowMajor(angle: number, axis: number): Mat3RowMajor {
  // CSPICE reduces `iaxis` mod 3 (treating 0 as 3). Mirror that for parity.
  if (!Number.isFinite(axis) || !Number.isInteger(axis)) {
    throw new Error(
      `Fake backend: rotate(): invalid axis: ${axis} (expected a finite integer)`,
    );
  }
  const iaxis = axis;
  const reduced = ((iaxis % 3) + 3) % 3;
  const spiceAxis = (reduced === 0 ? 3 : reduced) as 1 | 2 | 3;

  const c = Math.cos(angle);
  const s = Math.sin(angle);

  switch (spiceAxis) {
    case 1:
      return brandMat3RowMajor(
        [
          1,
          0,
          0,
          0,
          canonicalizeZero(c),
          canonicalizeZero(-s),
          0,
          canonicalizeZero(s),
          canonicalizeZero(c),
        ] as const,
        { label: "fake.rotate" },
      );
    case 2:
      return brandMat3RowMajor(
        [
          canonicalizeZero(c),
          0,
          canonicalizeZero(s),
          0,
          1,
          0,
          canonicalizeZero(-s),
          0,
          canonicalizeZero(c),
        ] as const,
        { label: "fake.rotate" },
      );
    case 3:
      return brandMat3RowMajor(
        [
          canonicalizeZero(c),
          canonicalizeZero(-s),
          0,
          canonicalizeZero(s),
          canonicalizeZero(c),
          0,
          0,
          0,
          1,
        ] as const,
        { label: "fake.rotate" },
      );
    default: {
      const _exhaustive: never = spiceAxis;
      throw new Error(`Fake backend: rotate(): unreachable axis: ${String(_exhaustive)}`);
    }
  }
}

function axisAngleToRotationRowMajor(axis: SpiceVector3, angle: number): Mat3RowMajor {
  const u = vhat(axis);
  const ux = u[0];
  const uy = u[1];
  const uz = u[2];

  // Parity with CSPICE axisar_c: if axis is zero, return identity rotation.
  if (ux === 0 && uy === 0 && uz === 0) {
    return brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as const, { label: "fake.axisar" });
  }

  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  return brandMat3RowMajor(
    [
      canonicalizeZero(t * ux * ux + c),
      canonicalizeZero(t * ux * uy - s * uz),
      canonicalizeZero(t * ux * uz + s * uy),

      canonicalizeZero(t * ux * uy + s * uz),
      canonicalizeZero(t * uy * uy + c),
      canonicalizeZero(t * uy * uz - s * ux),

      canonicalizeZero(t * ux * uz - s * uy),
      canonicalizeZero(t * uy * uz + s * ux),
      canonicalizeZero(t * uz * uz + c),
    ] as const,
    { label: "fake.axisar" },
  );
}

function georec(lon: number, lat: number, alt: number, re: number, f: number): SpiceVector3 {
  // Match CSPICE validation semantics where feasible.
  if (!Number.isFinite(re) || re <= 0) {
    throw new Error(`Fake backend: georec(): invalid re: ${re} (expected > 0)`);
  }
  if (!Number.isFinite(f) || f >= 1) {
    throw new Error(`Fake backend: georec(): invalid f: ${f} (expected < 1)`);
  }

  // Standard geodetic-to-rectangular conversion.
  const rp = re * (1 - f);
  const e2 = 1 - (rp * rp) / (re * re);

  const slat = Math.sin(lat);
  const clat = Math.cos(lat);
  const slon = Math.sin(lon);
  const clon = Math.cos(lon);

  const n = re / Math.sqrt(1 - e2 * slat * slat);

  const x = (n + alt) * clat * clon;
  const y = (n + alt) * clat * slon;
  const z = (n * (1 - e2) + alt) * slat;

  return [x, y, z];
}

function recgeo(rect: SpiceVector3, re: number, f: number): { lon: number; lat: number; alt: number } {
  // Match CSPICE validation semantics where feasible.
  if (!Number.isFinite(re) || re <= 0) {
    throw new Error(`Fake backend: recgeo(): invalid re: ${re} (expected > 0)`);
  }
  if (!Number.isFinite(f) || f >= 1) {
    throw new Error(`Fake backend: recgeo(): invalid f: ${f} (expected < 1)`);
  }

  // Bowring's method (non-iterative) for rectangular to geodetic.
  const x = rect[0];
  const y = rect[1];
  const z = rect[2];

  const rp = re * (1 - f);
  const e2 = 1 - (rp * rp) / (re * re);
  const ep2 = (re * re - rp * rp) / (rp * rp);

  const lon = Math.atan2(y, x);
  const p = Math.sqrt(x * x + y * y);

  // Handle poles / near-pole numerical stability.
  // Avoid the general-case `alt = p / cos(lat) - n` path when `p` is tiny.
  // (Near-pole cases are extremely sensitive as `cos(lat) -> 0`.)
  const poleTol = 1e-14 * re;
  if (p <= poleTol) {
    const poleLon = 0;
    const poleLat = z >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const poleAlt = Math.abs(z) - rp;
    return { lon: poleLon, lat: poleLat, alt: poleAlt };
  }

  const theta = Math.atan2(z * re, p * rp);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);

  const lat = Math.atan2(z + ep2 * rp * st * st * st, p - e2 * re * ct * ct * ct);

  const slat = Math.sin(lat);
  const n = re / Math.sqrt(1 - e2 * slat * slat);
  const alt = p / Math.cos(lat) - n;

  return { lon, lat, alt };
}

function mtx3(m: Mat3RowMajor): Mat3RowMajor {
  return brandMat3RowMajor(
    [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]] as const,
    { label: "fake.mtx3" },
  );
}

function mxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mtxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3 {
  // (m^T) * v
  return mxv(mtx3(m), v);
}

function sxformRowMajor(from: SupportedFrameName, to: SupportedFrameName, et: number): SpiceMatrix6x6 {
  const wFrom = FRAME_SPIN_RATE_RAD_PER_SEC[from];
  const wTo = FRAME_SPIN_RATE_RAD_PER_SEC[to];
  const wDelta = wFrom - wTo;

  const theta = wDelta * et;
  const r = rotZRowMajor(theta);
  const dr = drotZRowMajor(theta, wDelta);

  // [ R 0 ; dR R ]
  return [
    // row 0
    r[0], r[1], r[2], 0, 0, 0,
    // row 1
    r[3], r[4], r[5], 0, 0, 0,
    // row 2
    r[6], r[7], r[8], 0, 0, 0,

    // row 3
    dr[0], dr[1], dr[2], r[0], r[1], r[2],
    // row 4
    dr[3], dr[4], dr[5], r[3], r[4], r[5],
    // row 5
    dr[6], dr[7], dr[8], r[6], r[7], r[8],
  ];
}

function mxv6(m: SpiceMatrix6x6, v: SpiceStateVector): SpiceStateVector {
  const out: number[] = new Array(6).fill(0);
  for (let r = 0; r < 6; r++) {
    let sum = 0;
    for (let c = 0; c < 6; c++) {
      sum += m[r * 6 + c]! * v[c]!;
    }
    out[r] = sum;
  }
  return out as SpiceStateVector;
}

/**
 * Deterministic toy ephemerides in J2000.
 */
function getAbsoluteStateInJ2000(bodyId: number, et: number): { posKm: SpiceVector3; velKmPerSec: SpiceVector3 } {
  switch (bodyId) {
    case BODY_IDS.SUN:
      return { posKm: [0, 0, 0], velKmPerSec: [0, 0, 0] };

    case BODY_IDS.EARTH: {
      const rKm = 149_597_870.7; // 1 AU
      const periodSec = 365.25 * 24 * 60 * 60;
      const w = TWO_PI / periodSec;
      const t = w * et;

      const c = Math.cos(t);
      const s = Math.sin(t);

      const x = rKm * c;
      const y = rKm * s;
      const vx = -rKm * w * s;
      const vy = rKm * w * c;

      return { posKm: [x, y, 0], velKmPerSec: [vx, vy, 0] };
    }

    case BODY_IDS.MOON: {
      const earth = getAbsoluteStateInJ2000(BODY_IDS.EARTH, et);

      const rKm = 384_400;
      const periodSec = 27.321661 * 24 * 60 * 60;
      const w = TWO_PI / periodSec;
      const t = w * et;

      const c = Math.cos(t);
      const s = Math.sin(t);

      const xRel = rKm * c;
      const yRel = rKm * s;
      const vxRel = -rKm * w * s;
      const vyRel = rKm * w * c;

      return {
        posKm: [earth.posKm[0] + xRel, earth.posKm[1] + yRel, 0],
        velKmPerSec: [earth.velKmPerSec[0] + vxRel, earth.velKmPerSec[1] + vyRel, 0],
      };
    }

    default:
      throw new Error(`Fake backend: unsupported body id: ${bodyId}`);
  }
}

function getRelativeStateInJ2000(target: string, observer: string, et: number): SpiceStateVector {
  const targetId = parseBodyRef(target);
  const observerId = parseBodyRef(observer);

  const t = getAbsoluteStateInJ2000(targetId, et);
  const o = getAbsoluteStateInJ2000(observerId, et);

  const relPos = vsub(t.posKm, o.posKm);
  const relVel = vsub(t.velKmPerSec, o.velKmPerSec);

  return [relPos[0], relPos[1], relPos[2], relVel[0], relVel[1], relVel[2]];
}

function applyStateTransform(from: SupportedFrameName, to: SupportedFrameName, et: number, state: SpiceStateVector): SpiceStateVector {
  const xform = sxformRowMajor(from, to, et);
  return mxv6(xform, state);
}

function isIso8601OrRfc3339Utcish(s: string): boolean {
  // Intentionally conservative. We only guarantee ISO/RFC3339-style parsing.
  // Examples:
  // - 2000-01-01T12:00:00Z
  // - 2000-01-01T12:00:00.123Z
  // - 2000-01-01T12:00:00+00:00
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s);
}

function formatUtcFromMs(ms: number, prec: number): string {
  const d = new Date(ms);
  // Base always has 3 decimals.
  const iso = d.toISOString();
  const [head, fracZ] = iso.split(".");
  const frac = (fracZ ?? "000Z").replace(/Z$/, "");

  const clampedPrec = Math.max(0, Math.min(12, prec));
  if (clampedPrec === 0) {
    return `${head}Z`;
  }

  const padded = (frac + "000000000000").slice(0, clampedPrec);
  return `${head}.${padded}Z`;
}

type KernelRecord = {
  file: string;
  source: string;
  filtyp: string;
  handle: number;
  kind: KernelKind;
};

function guessKernelKind(path: string): KernelKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".bsp")) return "SPK";
  if (lower.endsWith(".bc")) return "CK";
  if (lower.endsWith(".bpc")) return "PCK";
  if (lower.endsWith(".bds") || lower.endsWith(".dsk")) return "DSK";
  if (lower.endsWith(".tpc") || lower.endsWith(".pck")) return "TEXT";
  if (lower.endsWith(".tls") || lower.endsWith(".lsk")) return "LSK";
  if (lower.endsWith(".tf") || lower.endsWith(".fk")) return "FK";
  if (lower.endsWith(".ti") || lower.endsWith(".ik")) return "IK";
  if (lower.endsWith(".tsc") || lower.endsWith(".sclk")) return "SCLK";
  if (lower.endsWith(".ek")) return "EK";
  if (lower.endsWith(".tm") || lower.endsWith(".meta")) return "META";
  return "UNKNOWN";
}

function assertNever(x: never, msg: string): never {
  throw new Error(msg);
}

function kernelFiltyp(kind: KernelKind): string {
  // Keep this close to NAIF-style strings, but it doesn't need to be exact.
  switch (kind) {
    case "SPK":
    case "CK":
    case "PCK":
    case "DSK":
    case "EK":
    case "META":
    case "TEXT":
      return kind;

    case "LSK":
    case "FK":
    case "IK":
    case "SCLK":
      return "TEXT";
    case "ALL":
      return "ALL";
    case "UNKNOWN":
      return "UNKNOWN";
  }

  // Compile-time exhaustiveness check: if a new KernelKind is added, TypeScript
  // forces us to intentionally map it.
  return assertNever(kind, `Unmapped KernelKind: ${kind}`);
}

function assertPoolRange(fn: string, start: number, room: number): void {
  if (!Number.isFinite(start) || !Number.isInteger(start) || start < 0) {
    throw new RangeError(`${fn}(): start must be an integer >= 0`);
  }
  if (!Number.isFinite(room) || !Number.isInteger(room) || room <= 0) {
    throw new RangeError(`${fn}(): room must be an integer > 0`);
  }
}

function assertNonEmptyString(fn: string, field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${fn}(): ${field} must be a non-empty string`);
  }
}

export function createFakeBackend(): SpiceBackend & { kind: "fake" } {
  let nextHandle = 1;
  let spiceFailed = false;
  let spiceShort = "";
  let spiceLong = "";
  const traceStack: string[] = [];
  const kernels: KernelRecord[] = [];

  type KernelPoolEntry =
    | { type: "N"; values: number[] }
    | { type: "C"; values: string[] };

  const kernelPool = new Map<string, KernelPoolEntry>();

  // swpool/cvpool "agent" state.
  const kernelPoolWatches = new Map<string, { names: string[]; dirty: boolean }>();
  const kernelPoolWatchesByName = new Map<string, Set<string>>();

  const unindexKernelPoolWatch = (agent: string, names: readonly string[]) => {
    for (const name of names) {
      const agents = kernelPoolWatchesByName.get(name);
      if (!agents) continue;
      agents.delete(agent);
      if (agents.size === 0) {
        kernelPoolWatchesByName.delete(name);
      }
    }
  };

  const indexKernelPoolWatch = (agent: string, names: readonly string[]) => {
    for (const name of names) {
      let agents = kernelPoolWatchesByName.get(name);
      if (!agents) {
        agents = new Set<string>();
        kernelPoolWatchesByName.set(name, agents);
      }
      agents.add(agent);
    }
  };

  const markKernelPoolUpdated = (name: string) => {
    // Avoid an O(watches * names) scan by maintaining a reverse index.
    const agents = kernelPoolWatchesByName.get(name);
    if (!agents) return;
    for (const agent of agents) {
      const watch = kernelPoolWatches.get(agent);
      if (watch) {
        watch.dirty = true;
      }
    }
  };

  const spiceCellUnsupported =
    "Fake backend does not support SpiceCell/SpiceWindow APIs (use wasm/node backend).";

  function normalizeKindInput(kind: KernelKindInput | undefined): readonly string[] {
    if (kind == null) {
      return ["ALL"];
    }
    if (Array.isArray(kind)) {
      return kind;
    }

    // Allow CSPICE-style multi-kind strings.
    const raw = String(kind);
    if (/\s/.test(raw)) {
      return raw
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    }

    return [raw];
  }

  const textKinds = new Set(["TEXT", "LSK", "FK", "IK", "SCLK"]);

  function matchesKernelKind(requested: ReadonlySet<string>, k: KernelRecord): boolean {
    if (requested.size === 0) {
      return false;
    }
    if (requested.has("ALL")) {
      return true;
    }

    const kind = k.kind.toUpperCase();
    if (requested.has(kind)) {
      return true;
    }

    // CSPICE TEXT covers all non-meta text kernels.
    if (requested.has("TEXT") && textKinds.has(kind)) {
      return true;
    }

    return false;
  }

  const getKernelsOfKind = (kind: KernelKindInput | undefined): readonly KernelRecord[] => {
    const requested = new Set(normalizeKindInput(kind).map((k) => k.toUpperCase()));
    return kernels.filter((k) => matchesKernelKind(requested, k));
  };

  return {
    kind: "fake",

    spiceVersion: () => FAKE_SPICE_VERSION,

    failed: () => spiceFailed,
    reset: () => {
      spiceFailed = false;
      spiceShort = "";
      spiceLong = "";
      traceStack.length = 0;
    },
    getmsg: (which) => {
      assertGetmsgWhich(which);
      if (which === "SHORT") return spiceShort;
      if (which === "LONG") return spiceLong;

      // EXPLAIN
      // CSPICE convention is typically:
      //   setmsg(long)
      //   sigerr(short)
      // so we avoid overwriting the long message when signaling.
      const trace = traceStack.length > 0 ? traceStack.join(" -> ") : "";
      if (!spiceLong && !trace) return "";
      if (spiceLong && !trace) return spiceLong;
      if (!spiceLong && trace) return `Trace: ${trace}`;
      return `${spiceLong}\n\nTrace: ${trace}`;
    },
    setmsg: (message: string) => {
      spiceLong = message;
    },
    sigerr: (short: string) => {
      spiceFailed = true;
      spiceShort = short;
    },
    chkin: (name: string) => {
      traceStack.push(name);
    },
    chkout: (name: string) => {
      const idx = traceStack.lastIndexOf(name);
      if (idx >= 0) traceStack.splice(idx, 1);
    },
    furnsh: (kernel: KernelSource) => {
      const file = typeof kernel === "string" ? kernel : kernel.path;
      const source = typeof kernel === "string" ? file : "bytes";

      const kind = guessKernelKind(file);
      const handle = nextHandle++;

      kernels.push({
        file,
        source,
        filtyp: kernelFiltyp(kind),
        handle,
        kind,
      });
    },

    unload: (path: string) => {
      const idx = kernels.findIndex((k) => k.file === path);
      if (idx >= 0) {
        kernels.splice(idx, 1);
      }
    },

    kclear: () => {
      kernels.length = 0;
      kernelPool.clear();
      kernelPoolWatches.clear();
      kernelPoolWatchesByName.clear();
    },

    kinfo: (path: string) => {
      const k = kernels.find((k) => k.file === path);
      if (!k) {
        return { found: false };
      }

      return {
        found: true,
        filtyp: k.filtyp,
        source: k.source,
        handle: k.handle,
      } satisfies Found<KernelInfo>;
    },

    kxtrct: (keywd, terms, wordsq) => {
      const termSet = new Set(terms);
      const words = [...wordsq.matchAll(/\S+/g)].map((m) => ({
        text: m[0],
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length - 1,
      }));

      const keyIndex = words.findIndex((w) => w.text === keywd);
      if (keyIndex < 0) {
        return { found: false };
      }

      let termIndex = -1;
      for (let i = keyIndex + 1; i < words.length; i++) {
        if (termSet.has(words[i]!.text)) {
          termIndex = i;
          break;
        }
      }

      const startSub = words[keyIndex + 1]?.start;
      const endSub = termIndex >= 0 ? words[termIndex]!.start : wordsq.length;
      const substr = startSub == null ? "" : wordsq.slice(startSub, endSub);

      const removalStart = words[keyIndex]!.start;
      const removalEnd = termIndex >= 0 ? words[(termIndex - 1) as number]!.end + 1 : wordsq.length;
      const newWordsq = wordsq.slice(0, removalStart) + wordsq.slice(removalEnd);

      return { found: true, wordsq: newWordsq, substr };
    },

    kplfrm: (_frmcls, _idset) => {
      throw new Error(spiceCellUnsupported);
    },

    ktotal: (kind: KernelKindInput = "ALL") => {
      return getKernelsOfKind(kind).length;
    },

    kdata: (which: number, kind: KernelKindInput = "ALL") => {
      const list = getKernelsOfKind(kind);
      const k = list[which];
      if (!k) return { found: false };
      return {
        found: true,
        file: k.file,
        filtyp: k.filtyp,
        source: k.source,
        handle: k.handle,
      } satisfies Found<KernelData>;
    },

    gdpool: (name, start, room) => {
      assertNonEmptyString("gdpool", "name", name);
      assertPoolRange("gdpool", start, room);
      const start0 = start;
      const room0 = room;

      const entry = kernelPool.get(name);
      if (!entry) return { found: false };
      if (entry.type !== "N") {
        throw new Error(`Fake backend: gdpool only supports numeric variables (got ${entry.type})`);
      }

      return {
        found: true,
        values: entry.values.slice(start0, start0 + room0),
      } satisfies Found<{ values: number[] }>;
    },

    gipool: (name, start, room) => {
      assertNonEmptyString("gipool", "name", name);
      assertPoolRange("gipool", start, room);
      const start0 = start;
      const room0 = room;

      const entry = kernelPool.get(name);
      if (!entry) return { found: false };
      if (entry.type !== "N") {
        throw new Error(`Fake backend: gipool only supports numeric variables (got ${entry.type})`);
      }

      return {
        found: true,
        values: entry.values.slice(start0, start0 + room0).map((v, i) => {
          assertSpiceInt32(v, `gipool(): values[${start0 + i}]`);
          return v;
        }),
      } satisfies Found<{ values: number[] }>;
    },

    gcpool: (name, start, room) => {
      assertNonEmptyString("gcpool", "name", name);
      assertPoolRange("gcpool", start, room);
      const start0 = start;
      const room0 = room;

      const entry = kernelPool.get(name);
      if (!entry) return { found: false };
      if (entry.type !== "C") {
        throw new Error(`Fake backend: gcpool only supports character variables (got ${entry.type})`);
      }

      return {
        found: true,
        values: entry.values.slice(start0, start0 + room0),
      } satisfies Found<{ values: string[] }>;
    },

    gnpool: (template, start, room) => {
      assertNonEmptyString("gnpool", "template", template);
      assertPoolRange("gnpool", start, room);
      const start0 = start;
      const room0 = room;

      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\[\]\\]/g, "\\$&");

      // Support escaping wildcard characters via backslash:
      // - `\*` matches a literal `*`
      // - `\%` matches a literal `%`
      let reSrc = "^";
      for (let i = 0; i < template.length; i++) {
        const ch = template[i]!;
        if (ch === "\\") {
          const next = template[i + 1];
          if (next !== undefined) {
            reSrc += escapeRegex(next);
            i++;
          } else {
            reSrc += "\\\\";
          }
          continue;
        }
        if (ch === "*") {
          reSrc += ".*";
          continue;
        }
        if (ch === "%") {
          reSrc += ".";
          continue;
        }
        reSrc += escapeRegex(ch);
      }
      reSrc += "$";

      const re = new RegExp(reSrc);

      const matches = Array.from(kernelPool.keys()).filter((k) => re.test(k)).sort();
      if (matches.length === 0) {
        return { found: false };
      }

      return {
        found: true,
        values: matches.slice(start0, start0 + room0),
      } satisfies Found<{ values: string[] }>;
    },

    dtpool: (name) => {
      assertNonEmptyString("dtpool", "name", name);
      const entry = kernelPool.get(name);
      if (!entry) return { found: false };
      return {
        found: true,
        n: entry.values.length,
        type: entry.type as KernelPoolVarType,
      } satisfies Found<{ n: number; type: KernelPoolVarType }>;
    },

    pdpool: (name, values) => {
      assertNonEmptyString("pdpool", "name", name);
      for (let i = 0; i < values.length; i++) {
        const v = values[i]!;
        if (!Number.isFinite(v)) {
          throw new RangeError(`pdpool(): values[${i}] must be a finite number (got ${String(v)})`);
        }
      }
      kernelPool.set(name, { type: "N", values: [...values] });
      markKernelPoolUpdated(name);
    },

    pipool: (name, values) => {
      assertNonEmptyString("pipool", "name", name);
      for (let i = 0; i < values.length; i++) {
        assertSpiceInt32(values[i]!, `pipool(): values[${i}]`);
      }
      kernelPool.set(name, { type: "N", values: [...values] });
      markKernelPoolUpdated(name);
    },

    pcpool: (name, values) => {
      assertNonEmptyString("pcpool", "name", name);
      kernelPool.set(name, { type: "C", values: [...values] });
      markKernelPoolUpdated(name);
    },

    swpool: (agent, names) => {
      assertNonEmptyString("swpool", "agent", agent);

      for (let i = 0; i < names.length; i++) {
        assertNonEmptyString("swpool", `names[${i}]`, names[i]!);
      }
      // CSPICE guarantees the next cvpool(agent) returns true.
      const prev = kernelPoolWatches.get(agent);
      if (prev) {
        unindexKernelPoolWatch(agent, prev.names);
      }

      kernelPoolWatches.set(agent, { names: [...names], dirty: true });
      indexKernelPoolWatch(agent, names);
    },

    cvpool: (agent) => {
      assertNonEmptyString("cvpool", "agent", agent);
      const watch = kernelPoolWatches.get(agent);
      if (!watch) return false;
      const dirty = watch.dirty;
      watch.dirty = false;
      return dirty;
    },

    expool: (name) => {
      assertNonEmptyString("expool", "name", name);
      const entry = kernelPool.get(name);
      return entry?.type === "N";
    },

    tkvrsn: (item) => {
      if (item !== "TOOLKIT") {
        throw new Error(`Fake backend: unsupported tkvrsn item: ${String(item)}`);
      }
      return FAKE_SPICE_VERSION;
    },

    str2et: (time) => {
      if (!isIso8601OrRfc3339Utcish(time)) {
        throw new Error(
          `Fake backend: str2et() only supports ISO-8601/RFC3339 timestamps (got ${JSON.stringify(time)})`,
        );
      }
      const ms = Date.parse(time);
      if (!Number.isFinite(ms)) {
        throw new Error(`Fake backend: failed to parse time: ${JSON.stringify(time)}`);
      }
      return (ms - J2000_UTC_MS) / 1000;
    },

    et2utc: (et, _format, prec) => {
      const ms = J2000_UTC_MS + et * 1000;
      return formatUtcFromMs(ms, prec);
    },

    timout: (et, _picture) => {
      // Picture formatting is out of scope for the fake backend; use ISO.
      const ms = J2000_UTC_MS + et * 1000;
      return formatUtcFromMs(ms, 3);
    },

    bodn2c: (name) => {
      const trimmed = normalizeName(name);
      const id = NAME_TO_ID.get(trimmed) ?? NAME_TO_ID.get(trimmed.toLowerCase());
      if (id === undefined) return { found: false };
      return { found: true, code: id };
    },

    bodc2n: (code) => {
      const meta = ID_TO_BODY.get(code);
      if (!meta) return { found: false };
      return { found: true, name: meta.name };
    },

    namfrm: (name) => {
      const trimmed = normalizeName(name);
      const code = FRAME_NAME_TO_CODE.get(trimmed) ?? FRAME_NAME_TO_CODE.get(trimmed.toLowerCase());
      if (code === undefined) return { found: false };
      return { found: true, code };
    },

    frmnam: (code) => {
      const name = FRAME_CODE_TO_NAME.get(code);
      if (!name) return { found: false };
      return { found: true, name };
    },

    cidfrm: (center) => {
      if (center === BODY_IDS.EARTH) {
        return { found: true, frcode: FRAME_CODES.IAU_EARTH, frname: "IAU_EARTH" };
      }
      if (center === BODY_IDS.MOON) {
        return { found: true, frcode: FRAME_CODES.IAU_MOON, frname: "IAU_MOON" };
      }
      return { found: false };
    },

    cnmfrm: (centerName) => {
      const id = NAME_TO_ID.get(centerName) ?? NAME_TO_ID.get(centerName.toLowerCase());
      if (id === undefined) return { found: false };
      return (id === BODY_IDS.EARTH
        ? { found: true, frcode: FRAME_CODES.IAU_EARTH, frname: "IAU_EARTH" }
        : id === BODY_IDS.MOON
          ? { found: true, frcode: FRAME_CODES.IAU_MOON, frname: "IAU_MOON" }
          : { found: false }) satisfies Found<{ frcode: number; frname: string }>;
    },

    scs2e: (_sc, sclkch) => {
      // Minimal deterministic stub: treat the string as a number of seconds.
      const n = Number(sclkch);
      return Number.isFinite(n) ? n : 0;
    },

    sce2s: (_sc, et) => {
      // Minimal deterministic stub.
      return String(et);
    },

    ckgp: (_inst, _sclkdp, _tol, _ref) => {
      return { found: false };
    },

    ckgpav: (_inst, _sclkdp, _tol, _ref) => {
      return { found: false };
    },

    pxform: (from, to, et) => {
      const f = parseFrameName(from);
      const t = parseFrameName(to);

      const wFrom = FRAME_SPIN_RATE_RAD_PER_SEC[f];
      const wTo = FRAME_SPIN_RATE_RAD_PER_SEC[t];

      const theta = (wFrom - wTo) * et;
      return rotZRowMajor(theta);
    },

    sxform: (from, to, et) => {
      const f = parseFrameName(from);
      const t = parseFrameName(to);
      return sxformRowMajor(f, t, et);
    },

    spkezr: (target, et, ref, abcorr, observer) => {
      // Keep these in the signature for API compatibility.
      void (abcorr satisfies AbCorr | string);

      const stateJ2000 = getRelativeStateInJ2000(target, observer, et);

      const outFrame = parseFrameName(ref);
      const state = outFrame === "J2000" ? stateJ2000 : applyStateTransform("J2000", outFrame, et, stateJ2000);

      return { state, lt: 0 };
    },

    spkpos: (target, et, ref, abcorr, observer) => {
      void (abcorr satisfies AbCorr | string);

      const { state } = ((): SpkezrResult => {
        return {
          state: getRelativeStateInJ2000(target, observer, et),
          lt: 0,
        };
      })();

      const outFrame = parseFrameName(ref);
      const transformed = outFrame === "J2000"
        ? state
        : applyStateTransform("J2000", outFrame, et, state);

      return {
        pos: [transformed[0], transformed[1], transformed[2]],
        lt: 0,
      } satisfies SpkposResult;
    },

    subpnt: (_method, target, et, fixref, abcorr, observer) => {
      void (abcorr satisfies AbCorr | string);

      const targetId = parseBodyRef(target);
      const radius = getBodyRadiusKm(targetId);

      // Position of observer relative target.
      const obsState = getRelativeStateInJ2000(observer, target, et);
      const obsPosJ = [obsState[0], obsState[1], obsState[2]] as SpiceVector3;

      const frame = parseFrameName(fixref);
      const obsPos = frame === "J2000" ? obsPosJ : mxv(rotZRowMajor(-FRAME_SPIN_RATE_RAD_PER_SEC[frame] * et), obsPosJ);

      const n = vhat(obsPos);
      const spoint = vscale(radius, n);
      const srfvec = vsub(spoint, obsPos);

      return { spoint, trgepc: et, srfvec } satisfies SubPointResult;
    },

    subslr: (_method, target, et, fixref, abcorr, _observer) => {
      void (abcorr satisfies AbCorr | string);

      const targetId = parseBodyRef(target);
      const radius = getBodyRadiusKm(targetId);

      // Position of Sun relative target.
      const sunState = getRelativeStateInJ2000("SUN", target, et);
      const sunPosJ = [sunState[0], sunState[1], sunState[2]] as SpiceVector3;

      const frame = parseFrameName(fixref);
      const sunPos = frame === "J2000" ? sunPosJ : mxv(rotZRowMajor(-FRAME_SPIN_RATE_RAD_PER_SEC[frame] * et), sunPosJ);

      const n = vhat(sunPos);
      const spoint = vscale(radius, n);
      const srfvec = vsub(spoint, sunPos);

      return { spoint, trgepc: et, srfvec } satisfies SubPointResult;
    },

    sincpt: (_method, _target, _et, _fixref, _abcorr, _observer, _dref, _dvec) => {
      return { found: false };
    },

    ilumin: (_method, target, et, fixref, abcorr, observer, spoint) => {
      void (abcorr satisfies AbCorr | string);

      const frame = parseFrameName(fixref);
      const inv = rotZRowMajor(FRAME_SPIN_RATE_RAD_PER_SEC[frame] * et);

      const spointJ = frame === "J2000" ? spoint : mxv(inv, spoint);

      const sunState = getRelativeStateInJ2000("SUN", target, et);
      const sunPosJ = [sunState[0], sunState[1], sunState[2]] as SpiceVector3;

      const obsState = getRelativeStateInJ2000(observer, target, et);
      const obsPosJ = [obsState[0], obsState[1], obsState[2]] as SpiceVector3;

      // Vectors from surface point.
      const srfToSunJ = vsub(sunPosJ, spointJ);
      const srfToObsJ = vsub(obsPosJ, spointJ);

      const normalJ = vhat(spointJ);

      const phase = angleBetween(srfToSunJ, srfToObsJ);
      const incdnc = angleBetween(normalJ, srfToSunJ);
      const emissn = angleBetween(normalJ, srfToObsJ);

      const srfvecJ = vsub(spointJ, obsPosJ);

      const srfvec = frame === "J2000" ? srfvecJ : mxv(rotZRowMajor(-FRAME_SPIN_RATE_RAD_PER_SEC[frame] * et), srfvecJ);

      return {
        trgepc: et,
        srfvec,
        phase,
        incdnc,
        emissn,
      } satisfies IluminResult;
    },

    occult: (
      _targ1,
      _shape1,
      _frame1,
      _targ2,
      _shape2,
      _frame2,
      abcorr,
      _observer,
      _et,
    ) => {
      void (abcorr satisfies AbCorr | string);
      // Deterministic stub: 0 => "no occultation".
      return 0;
    },

    // --- file i/o primitives (not implemented in fake backend) ---

    exists: (_path: string) => {
      throw new Error("Fake backend: exists() is not implemented");
    },
    getfat: (_path: string) => {
      throw new Error("Fake backend: getfat() is not implemented");
    },
    dafopr: (_path: string) => {
      throw new Error("Fake backend: dafopr() is not implemented");
    },
    dafcls: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: dafcls() is not implemented");
    },
    dafbfs: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: dafbfs() is not implemented");
    },
    daffna: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: daffna() is not implemented");
    },
    dasopr: (_path: string) => {
      throw new Error("Fake backend: dasopr() is not implemented");
    },
    dascls: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: dascls() is not implemented");
    },
    dlaopn: (_path: string, _ftype: string, _ifname: string, _ncomch: number) => {
      throw new Error("Fake backend: dlaopn() is not implemented");
    },
    dlabfs: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: dlabfs() is not implemented");
    },
    dlafns: (_handle: SpiceHandle, _descr: DlaDescriptor) => {
      throw new Error("Fake backend: dlafns() is not implemented");
    },
    dlacls: (_handle: SpiceHandle) => {
      throw new Error("Fake backend: dlacls() is not implemented");
    },

    // -- Cells + windows -----------------------------------------------------
    //
    // The fake backend is intentionally minimal and does not attempt to
    // simulate CSPICE cell/window semantics.

    newIntCell: (_size) => {
      throw new Error(spiceCellUnsupported);
    },
    newDoubleCell: (_size) => {
      throw new Error(spiceCellUnsupported);
    },
    newCharCell: (_size, _length) => {
      throw new Error(spiceCellUnsupported);
    },
    newWindow: (_maxIntervals) => {
      throw new Error(spiceCellUnsupported);
    },
    freeCell: (_cell) => {
      throw new Error(spiceCellUnsupported);
    },
    freeWindow: (_window) => {
      throw new Error(spiceCellUnsupported);
    },

    ssize: (_size, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    scard: (_card, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    card: (_cell) => {
      throw new Error(spiceCellUnsupported);
    },
    size: (_cell) => {
      throw new Error(spiceCellUnsupported);
    },
    valid: (_size, _n, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    insrti: (_item, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    insrtd: (_item, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    insrtc: (_item, _cell) => {
      throw new Error(spiceCellUnsupported);
    },
    cellGeti: (_cell, _index) => {
      throw new Error(spiceCellUnsupported);
    },
    cellGetd: (_cell, _index) => {
      throw new Error(spiceCellUnsupported);
    },
    cellGetc: (_cell, _index) => {
      throw new Error(spiceCellUnsupported);
    },
    wninsd: (_left, _right, _window) => {
      throw new Error(spiceCellUnsupported);
    },
    wncard: (_window) => {
      throw new Error(spiceCellUnsupported);
    },
    wnfetd: (_window, _index) => {
      throw new Error(spiceCellUnsupported);
    },
    wnvald: (_size, _n, _window) => {
      throw new Error(spiceCellUnsupported);
    },

    reclat: (rect) => {
      const x = rect[0];
      const y = rect[1];
      const z = rect[2];
      const radius = vnorm(rect);
      const lon = Math.atan2(y, x);
      const lat = radius === 0 ? 0 : Math.asin(clamp(z / radius, -1, 1));
      return { radius, lon, lat };
    },

    latrec: (radius, lon, lat) => {
      const clat = Math.cos(lat);
      return [
        radius * clat * Math.cos(lon),
        radius * clat * Math.sin(lon),
        radius * Math.sin(lat),
      ];
    },

    recsph: (rect) => {
      const x = rect[0];
      const y = rect[1];
      const z = rect[2];
      const radius = vnorm(rect);
      const lon = Math.atan2(y, x);
      const colat = radius === 0 ? 0 : Math.acos(clamp(z / radius, -1, 1));
      return { radius, colat, lon };
    },

    sphrec: (radius, colat, lon) => {
      const slat = Math.sin(Math.PI / 2 - colat);
      const clat = Math.cos(Math.PI / 2 - colat);
      return [
        radius * clat * Math.cos(lon),
        radius * clat * Math.sin(lon),
        radius * slat,
      ];
    },

    vnorm: (v) => vnorm(v),
    vhat: (v) => vhat(v),
    vdot: (a, b) => vdot(a, b),
    vcrss: (a, b) => vcrss(a, b),

    mxv: (m, v) => mxv(m, v),
    mtxv: (m, v) => mtxv(m, v),


    vadd: (a, b) => vadd(a, b),
    vsub: (a, b) => vsub(a, b),
    vminus: (v) => vscale(-1, v),
    vscl: (s, v) => vscale(s, v),

    mxm: (a, b) => mmul3(a, b),

    rotate: (angle, axis) => rotateRowMajor(angle, axis),
    // CSPICE rotmat_c left-multiplies: mout = rotate(angle, axis) * m
    rotmat: (m, angle, axis) => mmul3(rotateRowMajor(angle, axis), m),
    axisar: (axis, angle) => axisAngleToRotationRowMajor(axis, angle),

    georec: (lon, lat, alt, re, f) => georec(lon, lat, alt, re, f),
    recgeo: (rect, re, f) => recgeo(rect, re, f),
  };
}
