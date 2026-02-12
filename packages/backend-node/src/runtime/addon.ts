import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type NativeAddon = {
  spiceVersion(): string;

  // --- error/status utilities ---
  failed(): boolean;
  reset(): void;
  getmsg(which: "SHORT" | "LONG" | "EXPLAIN"): string;
  setmsg(message: string): void;
  sigerr(short: string): void;
  chkin(name: string): void;
  chkout(name: string): void;

  furnsh(path: string): void;
  unload(path: string): void;
  kclear(): void;
  ktotal(kind?: string): number;
  kdata(
    which: number,
    kind?: string,
  ): { found: boolean; file?: string; filtyp?: string; source?: string; handle?: number };


  // --- kernel management ---
  kinfo(path: string): { found: boolean; filtyp?: string; source?: string; handle?: number };
  kxtrct(
    keywd: string,
    terms: readonly string[],
    wordsq: string,
  ): { found: boolean; wordsq?: string; substr?: string };
  kplfrm(frmcls: number, idset: number): void;

  // --- kernel pool ---
  gdpool(name: string, start: number, room: number): { found: boolean; values?: number[] };
  gipool(name: string, start: number, room: number): { found: boolean; values?: number[] };
  gcpool(name: string, start: number, room: number): { found: boolean; values?: string[] };
  gnpool(template: string, start: number, room: number): { found: boolean; values?: string[] };
  dtpool(name: string): { found: boolean; n?: number; type?: string };

  pdpool(name: string, values: readonly number[]): void;
  pipool(name: string, values: readonly number[]): void;
  pcpool(name: string, values: readonly string[]): void;

  swpool(agent: string, names: readonly string[]): void;
  cvpool(agent: string): boolean;
  expool(name: string): boolean;
  str2et(utc: string): number;
  et2utc(et: number, format: string, prec: number): string;
  timout(et: number, picture: string): string;

  // --- file i/o primitives ---

  exists(path: string): boolean;
  getfat(path: string): { arch: string; type: string };

  dafopr(path: string): number;
  dafcls(handle: number): void;
  dafbfs(handle: number): void;
  daffna(handle: number): boolean;

  dasopr(path: string): number;
  dascls(handle: number): void;

  dlaopn(path: string, ftype: string, ifname: string, ncomch: number): number;
  dlabfs(handle: number): { found: boolean; descr?: Record<string, unknown> };
  dlafns(handle: number, descr: Record<string, unknown>): { found: boolean; descr?: Record<string, unknown> };
  dlacls(handle: number): void;


  bodn2c(name: string): { found: boolean; code?: number };
  bodc2n(code: number): { found: boolean; name?: string };
  bodc2s(code: number): string;
  bods2c(name: string): { found: boolean; code?: number };
  boddef(name: string, code: number): void;
  bodfnd(body: number, item: string): boolean;
  bodvar(body: number, item: string): number[];
  namfrm(name: string): { found: boolean; code?: number };
  frmnam(code: number): { found: boolean; name?: string };
  cidfrm(center: number): { found: boolean; frcode?: number; frname?: string };
  cnmfrm(centerName: string): { found: boolean; frcode?: number; frname?: string };
  frinfo(frameId: number): { found: boolean; center?: number; frameClass?: number; classId?: number };
  ccifrm(frameClass: number, classId: number): { found: boolean; frcode?: number; frname?: string; center?: number };

  scs2e(sc: number, sclkch: string): number;
  sce2s(sc: number, et: number): string;
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): { found: boolean; cmat?: number[]; clkout?: number };
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): { found: boolean; cmat?: number[]; av?: number[]; clkout?: number };

  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string
  ): { state: number[]; lt: number };

  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string
  ): { pos: number[]; lt: number };

  subpnt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
  ): { spoint: number[]; trgepc: number; srfvec: number[] };

  subslr(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
  ): { spoint: number[]; trgepc: number; srfvec: number[] };

  sincpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    dref: string,
    dvec: number[],
  ): { found: boolean; spoint?: number[]; trgepc?: number; srfvec?: number[] };

  ilumin(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    spoint: number[],
  ): { trgepc: number; srfvec: number[]; phase: number; incdnc: number; emissn: number };

  occult(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: string,
    observer: string,
    et: number,
  ): number;
  pxform(from: string, to: string, et: number): number[];
  sxform(from: string, to: string, et: number): number[];

  reclat(rect: number[]): { radius: number; lon: number; lat: number };
  latrec(radius: number, lon: number, lat: number): number[];
  recsph(rect: number[]): { radius: number; colat: number; lon: number };
  sphrec(radius: number, colat: number, lon: number): number[];

  vnorm(v: number[]): number;
  vhat(v: number[]): number[];
  vdot(a: number[], b: number[]): number;
  vcrss(a: number[], b: number[]): number[];
  mxv(m: readonly number[], v: readonly number[]): number[];
  mtxv(m: readonly number[], v: readonly number[]): number[];

  vadd(a: readonly number[], b: readonly number[]): number[];
  vsub(a: readonly number[], b: readonly number[]): number[];
  vminus(v: readonly number[]): number[];
  vscl(s: number, v: readonly number[]): number[];

  mxm(a: readonly number[], b: readonly number[]): number[];
  rotate(angle: number, axis: number): number[];
  rotmat(m: readonly number[], angle: number, axis: number): number[];
  axisar(axis: readonly number[], angle: number): number[];

  georec(lon: number, lat: number, alt: number, re: number, f: number): number[];
  recgeo(rect: readonly number[], re: number, f: number): { lon: number; lat: number; alt: number };

  // Cells + windows
  newIntCell(size: number): number;
  newDoubleCell(size: number): number;
  newCharCell(size: number, length: number): number;
  newWindow(maxIntervals: number): number;

  freeCell(cell: number): void;
  freeWindow(window: number): void;

  ssize(size: number, cell: number): void;
  scard(card: number, cell: number): void;
  card(cell: number): number;
  size(cell: number): number;
  valid(size: number, n: number, cell: number): void;

  insrti(item: number, cell: number): void;
  insrtd(item: number, cell: number): void;
  insrtc(item: string, cell: number): void;

  cellGeti(cell: number, index: number): number;
  cellGetd(cell: number, index: number): number;
  cellGetc(cell: number, index: number): string;

  wninsd(left: number, right: number, window: number): void;
  wncard(window: number): number;
  wnfetd(window: number, index: number): number[];
  wnvald(size: number, n: number, window: number): void;

  /** Internal test helper (not part of the backend contract). */
  __ktotalAll(): number;
};

let cachedAddon: NativeAddon | undefined;

const ADDON_TARGET = "tspice_backend_node";
const ADDON_FILE = `${ADDON_TARGET}.node`;

const NATIVE_PLATFORM_PACKAGES = {
  darwin: {
    arm64: "@rybosome/tspice-native-darwin-arm64",
    x64: "@rybosome/tspice-native-darwin-x64",
  },
  linux: {
    x64: "@rybosome/tspice-native-linux-x64-gnu",
  },
} as const;

const BUILD_HINT =
  "Try rebuilding it: pnpm run fetch:cspice && pnpm -C packages/backend-node build:native. " +
  "Or set TSPICE_CSPICE_DIR=/abs/path/to/cspice (containing include/ and lib/). " +
  "Or set TSPICE_BACKEND_NODE_BINDING_PATH to an explicit .node path.";

function getPackageRoot(importMetaUrl: string): string {
  // Works both in the monorepo layout (`.../backend-node/dist/runtime/addon.js`) and
  // in the published `dist-publish/` layout where this code is vendored into
  // `@rybosome/tspice`.
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..", "..");
}

function loadAddon(require: NodeRequire, bindingPath: string): NativeAddon {
  const resolved = path.resolve(bindingPath);
  try {
    return require(resolved) as NativeAddon;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { arch, platform } = process;
    throw new Error(
      `Failed to load tspice native backend at "${resolved}" for ${platform}-${arch}. ` +
        `${BUILD_HINT} ` +
        `Original error: ${errorMessage}`,
      { cause: error }
    );
  }
}

function tryGetPlatformBindingPath(require: NodeRequire): string | undefined {
  const platform = process.platform as keyof typeof NATIVE_PLATFORM_PACKAGES;
  const arch = process.arch as string;

  const pkgName =
    NATIVE_PLATFORM_PACKAGES[platform]?.[
      arch as keyof (typeof NATIVE_PLATFORM_PACKAGES)[typeof platform]
    ];

  if (!pkgName) {
    return undefined;
  }

  try {
    const mod = require(pkgName) as unknown;
    if (typeof mod === "string") {
      return mod;
    }
    if (
      typeof mod === "object" &&
      mod !== null &&
      "bindingPath" in mod &&
      typeof (mod as { bindingPath?: unknown }).bindingPath === "string"
    ) {
      return (mod as { bindingPath: string }).bindingPath;
    }
    return undefined;
  } catch (error) {
    // If the platform package isn't installed, that's expected.
    if ((error as NodeJS.ErrnoException | undefined)?.code === "MODULE_NOT_FOUND") {
      return undefined;
    }
    throw error;
  }
}

export function getNativeAddon(): NativeAddon {
  if (cachedAddon) {
    return cachedAddon;
  }

  const require = createRequire(import.meta.url);
  const packageRoot = getPackageRoot(import.meta.url);
  const override = process.env.TSPICE_BACKEND_NODE_BINDING_PATH;
  if (override) {
    const resolvedOverride = path.resolve(packageRoot, override);
    if (!fs.existsSync(resolvedOverride)) {
      const { arch, platform } = process;
      throw new Error(
        `TSPICE_BACKEND_NODE_BINDING_PATH points to a non-existent file: ${resolvedOverride} (platform=${platform}, arch=${arch}). Ensure it points to a built ${ADDON_FILE}.`
      );
    }

    cachedAddon = loadAddon(require, resolvedOverride);
    return cachedAddon;
  }

  const platformBindingPath = tryGetPlatformBindingPath(require);
  if (platformBindingPath) {
    cachedAddon = loadAddon(require, platformBindingPath);
    return cachedAddon;
  }

  const candidates = [
    path.join(packageRoot, "native", "build", "Release", ADDON_FILE),
  ];

  const existing = candidates.find((p) => fs.existsSync(p));
  if (!existing) {
    const { arch, platform } = process;
    throw new Error(
      `Native addon ${ADDON_FILE} not found for ${platform}-${arch}. Looked for:\n` +
        candidates.map((p) => `- ${p}`).join("\n") +
        `\n\nIf you built a Debug addon locally, set TSPICE_BACKEND_NODE_BINDING_PATH to its path.` +
        `\n\n${BUILD_HINT}`
    );
  }

  cachedAddon = loadAddon(require, existing);

  return cachedAddon;
}
