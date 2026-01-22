import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export type NativeAddon = {
  spiceVersion(): string;

  // Phase 1
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

  // Phase 2
  bodn2c(name: string): { found: boolean; code?: number };
  bodc2n(code: number): { found: boolean; name?: string };
  namfrm(frameName: string): { found: boolean; frameId?: number };
  frmnam(frameId: number): { found: boolean; frameName?: string };

  // Phase 3
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string
  ): { state: number[]; lt: number };
  pxform(from: string, to: string, et: number): number[];
  sxform(from: string, to: string, et: number): number[];
};

let cachedAddon: NativeAddon | undefined;

const ADDON_TARGET = "tspice_backend_node";
const ADDON_FILE = `${ADDON_TARGET}.node`;

const BUILD_HINT =
  "Try rebuilding it: pnpm run fetch:cspice && pnpm -C packages/backend-node build:native. " +
  "Or set TSPICE_CSPICE_DIR=/abs/path/to/cspice (containing include/ and lib/). " +
  "Or set TSPICE_BACKEND_NODE_BINDING_PATH to an explicit .node path.";

function getPackageRoot(importMetaUrl: string): string {
  const require = createRequire(importMetaUrl);
  const packageJsonPath = require.resolve("../package.json");
  return path.dirname(packageJsonPath);
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
