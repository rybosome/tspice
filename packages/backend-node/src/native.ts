import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type NativeAddon = {
  spiceVersion(): string;
};

let cachedAddon: NativeAddon | undefined;

function getPackageRoot(importMetaUrl: string): string {
  const currentDir = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(currentDir, "..");
}

export function getNativeAddon(): NativeAddon {
  if (cachedAddon) {
    return cachedAddon;
  }

  const require = createRequire(import.meta.url);
  const packageRoot = getPackageRoot(import.meta.url);
  const bindingPath = path.join(
    packageRoot,
    "native",
    "build",
    "Release",
    "tspice_backend_node.node"
  );

  cachedAddon = require(bindingPath) as NativeAddon;
  return cachedAddon;
}
