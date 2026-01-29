import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type NativeAddon = {
  spiceVersion(): string;

  furnsh(path: string): void;
  unload(path: string): void;
  kclear(): void;
  ktotal(kind?: string): number;
  kdata(
    which: number,
    kind?: string,
  ): { found: boolean; file?: string; filtyp?: string; source?: string; handle?: number };
  str2et(utc: string): number;
  et2utc(et: number, format: string, prec: number): string;
  timout(et: number, picture: string): string;

  bodn2c(name: string): { found: boolean; code?: number };
  bodc2n(code: number): { found: boolean; name?: string };
  namfrm(name: string): { found: boolean; code?: number };
  frmnam(code: number): { found: boolean; name?: string };
  cidfrm(center: number): { found: boolean; frcode?: number; frname?: string };
  cnmfrm(centerName: string): { found: boolean; frcode?: number; frname?: string };

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
  mxv(m: number[], v: number[]): number[];
  mtxv(m: number[], v: number[]): number[];

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
