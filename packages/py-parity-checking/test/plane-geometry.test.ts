import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function runOracle(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        fileURLToPath(new URL("../sidecars/spiceypy/", import.meta.url)),
        "python",
        "-c",
        program,
      ],
      { encoding: "utf8", timeout: 30_000 },
    ),
  );
}

// Invoke the installed canonical wrappers. Only nonfinite output components
// require tags: preserve their position, sign of infinity and every finite value.
const extremesProgram = `
import json, math, sys
import spiceypy as sp

def number(x):
    x = float(x)
    if math.isnan(x): return "NaN"
    if x == math.inf: return "+Inf"
    if x == -math.inf: return "-Inf"
    return x

def plane(p): return [*p.normal, p.constant]
def nearest(p):
    point, distance = p
    return [*point, distance]

m = sys.float_info.max
rows = [
    plane(sp.nvp2pl([1,1,0], [m,m,7])),
    plane(sp.psv2pl([m,m,7], [0,0,1], [1,-1,0])),
    sp.vprjp([3,5,-m], sp.nvc2pl([0,0,1], m)),
    sp.vprjp([-3,5,m], sp.nvc2pl([0,0,-1], m)),
    nearest(sp.nplnpt([0,0,0], [1,0,0], [2,m,m])),
    nearest(sp.nplnpt([0,0,0], [math.ulp(0.),0,0], [2,3,5])),
    plane(sp.nvp2pl([1,1,0], [m/4,m/4,7])),
    plane(sp.psv2pl([m/4,m/4,7], [0,0,1], [1,-1,0])),
    sp.vprjp([3,5,-m/4], sp.nvc2pl([0,0,1], m/4)),
    nearest(sp.nplnpt([0,0,0], [1,0,0], [2,3,4])),
]
assert not sp.failed()
print(json.dumps([[number(x) for x in row] for row in rows], allow_nan=False))
`;

const thresholdProgram = `
import json, math, sys
import spiceypy as sp
proj = sp.nvc2pl([1,0,0], 0)
rows = []
for numer in (0., 0.5, 2.):
    limit = (10. / sys.float_info.max) * max(1., abs(numer))
    for denom in (math.nextafter(limit, 0.), limit, math.nextafter(limit, math.inf), -math.nextafter(limit, math.inf)):
        inv = sp.nvc2pl([denom,1,0], 2.+numer)
        with sp.no_found_check():
            out, found = sp.vprjpi([0,2,-3], proj, inv)
        rows.append([denom, bool(found), out.tolist() if found else None])
assert not sp.failed()
print(json.dumps(rows, allow_nan=False))
`;

function compareNumbers(actual: readonly number[], expected: unknown): void {
  if (!Array.isArray(expected)) throw new Error("Missing oracle row");
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value: unknown, i) => {
    const observed = actual[i]!;
    if (value === "NaN") expect(Number.isNaN(observed)).toBe(true);
    else if (value === "+Inf") expect(observed).toBe(Infinity);
    else if (value === "-Inf") expect(observed).toBe(-Infinity);
    else if (typeof value === "number" && Number.isFinite(value)) {
      if (value === 0) expect(observed === 0).toBe(true);
      else
        expect(Math.abs((observed - value) / value)).toBeLessThanOrEqual(3e-15);
    } else throw new Error("Invalid oracle scalar");
  });
}

function near(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 12));
}

for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: retains every IEEE component and finite control from the locked CSPICE plane and line routines`, async () => {
    const expected = runOracle(extremesProgram);
    if (!Array.isArray(expected))
      throw new Error("Missing geometry oracle rows");
    // Confirm the fixtures actually reach each exceptional representation.
    expect(expected[0]?.[3]).toBe("+Inf");
    expect(expected[1]?.[3]).toBe("+Inf");
    expect(expected[2]).toEqual(["NaN", "NaN", "+Inf"]);
    expect(expected[3]).toEqual(["NaN", "NaN", "-Inf"]);
    expect(expected[4]?.[3]).toBe("+Inf");
    expect(expected[5]).toEqual(["NaN", "NaN", "NaN", "NaN"]);
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const raw = spice.raw,
        m = Number.MAX_VALUE;
      const nearest = (value: ReturnType<typeof raw.nplnpt>) => [
        ...value.pnear,
        value.dist,
      ];
      const rows = [
        raw.nvp2pl([1, 1, 0], [m, m, 7]),
        raw.psv2pl([m, m, 7], [0, 0, 1], [1, -1, 0]),
        raw.vprjp([3, 5, -m], raw.nvc2pl([0, 0, 1], m)),
        raw.vprjp([-3, 5, m], raw.nvc2pl([0, 0, -1], m)),
        nearest(raw.nplnpt([0, 0, 0], [1, 0, 0], [2, m, m])),
        nearest(raw.nplnpt([0, 0, 0], [Number.MIN_VALUE, 0, 0], [2, 3, 5])),
        raw.nvp2pl([1, 1, 0], [m / 4, m / 4, 7]),
        raw.psv2pl([m / 4, m / 4, 7], [0, 0, 1], [1, -1, 0]),
        raw.vprjp([3, 5, -m / 4], raw.nvc2pl([0, 0, 1], m / 4)),
        nearest(raw.nplnpt([0, 0, 0], [1, 0, 0], [2, 3, 4])),
      ];
      expect(rows).toHaveLength(expected.length);
      rows.forEach((row, i) => compareNumbers(row, expected[i]));
    } finally {
      await dispose();
    }
  });

  test(`${backend}: compares both sides and equality at the actual VPRJPI strict representability bound`, async () => {
    const expected = runOracle(thresholdProgram);
    if (!Array.isArray(expected) || expected.length !== 12)
      throw new Error("Missing inverse-projection boundary results");
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        proj = raw.nvc2pl([1, 0, 0], 0);
      for (const [i, numer] of [0, 0.5, 2].entries()) {
        const limit = (10 / Number.MAX_VALUE) * Math.max(1, Math.abs(numer));
        const bits = new DataView(new ArrayBuffer(8));
        bits.setFloat64(0, limit);
        const original = bits.getBigUint64(0);
        bits.setBigUint64(0, original - 1n);
        const below = bits.getFloat64(0);
        bits.setBigUint64(0, original + 1n);
        const above = bits.getFloat64(0);
        for (const [j, denom] of [below, limit, above, -above].entries()) {
          const row: unknown = expected[4 * i + j];
          if (!Array.isArray(row) || row.length !== 3)
            throw new Error("Invalid inverse-projection oracle row");
          expect(row[0]).toBe(denom);
          expect(row[1]).toBe(j >= 2);
          const inv = raw.nvc2pl([denom, 1, 0], 2 + numer);
          const actual = raw.vprjpi([0, 2, -3], proj, inv);
          expect(actual.found).toBe(row[1]);
          if (actual.found) compareNumbers(actual.vout, row[2]);
          else {
            expect(row[2]).toBeNull();
            expect(actual).toEqual({ found: false });
          }
        }
      }
    } finally {
      await dispose();
    }
  });

  test(`${backend}: reconstructs a translated oblique plane and its projected point with owned outputs`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        seed = [5, 3, 7] as const,
        normal = [2, -1, 2] as const;
      const plane = raw.nvp2pl(normal, seed);
      near(plane, [2 / 3, -1 / 3, 2 / 3, 7]);
      const { normal: unit, point: foot } = raw.pl2nvp(plane);
      near(unit, plane.slice(0, 3));
      near(foot, [14 / 3, -7 / 3, 14 / 3]);
      const basis = raw.pl2psv(plane);
      near(basis.point, foot);
      near(raw.psv2pl(basis.point, basis.span1, basis.span2), plane);
      near(raw.nvp2pl(unit, foot), plane);
      const [x, y, z] = basis.span1,
        [u, v, w] = basis.span2;
      near([y * w - z * v, z * u - x * w, x * v - y * u], unit);
      const proj = raw.nvc2pl([0, 0, 1], 0),
        image = raw.vprjp(seed, proj);
      near(image, [5, 3, 0]);
      const inverse = raw.vprjpi(image, proj, plane);
      expect(inverse.found).toBe(true);
      if (!inverse.found) throw new Error("Missing oblique inverse");
      near(inverse.vout, seed);
      near(raw.vprjp(inverse.vout, proj), image);
      const hit = raw.inrypl([-11, 11, -9], normal, plane);
      expect(hit.nxpts).toBe(1);
      near(hit.xpt, seed);
      const closest = raw.nplnpt([0, 0, 0], normal, seed);
      near(closest.pnear, foot);
      expect(closest.dist).toBeCloseTo(
        Math.hypot(5 - foot[0], 3 - foot[1], 7 - foot[2]),
        12,
      );
      basis.point[0] = 12345;
      unit[0] = -44;
      expect(plane[0]).toBeCloseTo(2 / 3, 14);
      near(raw.pl2nvp(plane).point, foot);
      near(hit.xpt, seed);
    } finally {
      await dispose();
    }
  });

  test(`${backend}: recovers after singular geometry and a ray at the toolkit distance bound`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const { raw } = spice,
        z2 = raw.nvp2pl([0, 0, 1], [3, 5, 2]);
      expect(() => raw.nvp2pl([0, 0, 0], [3, 5, 2])).toThrow(/ZEROVECTOR/);
      expect(() => raw.psv2pl([3, 5, 2], [1, 0, 0], [-2, 0, 0])).toThrow(
        /DEGENERATECASE/,
      );
      expect(() => raw.nplnpt([0, 0, 0], [0, 0, 0], [3, 5, 2])).toThrow(
        /ZEROVECTOR/,
      );
      expect(() =>
        raw.inrypl([Number.MAX_VALUE / 3, 0, 0], [0, 0, 1], z2),
      ).toThrow(/VECTORTOOBIG/);
      for (const [dir, count, point] of [
        [[0, 0, 1], 1, [3, 5, 2]],
        [[1, 0, 0], 0, [0, 0, 0]],
        [[0, 0, -1], 0, [0, 0, 0]],
      ] as const) {
        const hit = raw.inrypl([3, 5, 0], dir, z2);
        expect(hit.nxpts).toBe(count);
        near(hit.xpt, point);
      }
      const inPlane = raw.inrypl([3, 5, 2], [1, 0, 0], z2);
      expect(inPlane.nxpts).toBe(-1);
      near(inPlane.xpt, [3, 5, 2]);
      expect(raw.nplnpt([0, 0, 0], [1, 0, 0], [3, 4, 0])).toEqual({
        pnear: [3, 0, 0],
        dist: 4,
      });
    } finally {
      await dispose();
    }
  });
}
