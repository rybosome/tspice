import path from "node:path";
import { createRequire } from "node:module";

export type NativeAddon = {
  spiceVersion(): string;
};

let cachedAddon: NativeAddon | undefined;

function getPackageRoot(importMetaUrl: string): string {
  const require = createRequire(importMetaUrl);
  const packageJsonPath = require.resolve("../package.json");
  return path.dirname(packageJsonPath);
}

export function getNativeAddon(): NativeAddon {
  if (cachedAddon) {
    return cachedAddon;
  }

  const require = createRequire(import.meta.url);
  const packageRoot = getPackageRoot(import.meta.url);
  const bindingPathFromEnv = process.env.TSPICE_BACKEND_NODE_BINDING_PATH;
  const bindingPath = bindingPathFromEnv
    ? path.resolve(packageRoot, bindingPathFromEnv)
    : path.join(packageRoot, "native", "build", "Release", "tspice_backend_node.node");

  try {
    cachedAddon = require(bindingPath) as NativeAddon;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { arch, platform } = process;
    throw new Error(
      `Failed to load tspice native backend at "${bindingPath}" for ${platform}-${arch}. Ensure the native addon is built for this platform/arch. Original error: ${errorMessage}`,
      { cause: error }
    );
  }

  return cachedAddon;
}
