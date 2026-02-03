import type { KernelSource } from "@rybosome/tspice-backend-contract";
import { normalizeVirtualKernelPath } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";
import { tspiceCall1Path } from "../codec/calls.js";

export type WasmFsApi = {
  writeFile(path: string, data: Uint8Array): void;
  loadKernel(path: string, data: Uint8Array): void;
};

export function resolveKernelPath(path: string): string {
  // We treat kernel paths as *virtual* WASM-FS paths under `/kernels`.
  // Normalize to a canonical absolute path.
  return `/kernels/${normalizeVirtualKernelPath(path)}`;
}

export function createWasmFs(module: EmscriptenModule): WasmFsApi {
  function writeFile(path: string, data: Uint8Array): void {
    const dir = path.split("/").slice(0, -1).join("/") || "/";
    if (dir && dir !== "/") {
      module.FS.mkdirTree(dir);
    }

    // Normalize to a tightly-sized, offset-0 view to avoid FS edge cases with Buffer pooling.
    const bytes =
      data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
        ? data
        : new Uint8Array(data);

    module.FS.writeFile(path, bytes);
  }

  return {
    writeFile,
    loadKernel: (path: string, data: Uint8Array) => {
      const resolvedPath = resolveKernelPath(path);
      writeFile(resolvedPath, data);
      tspiceCall1Path(module, module._tspice_furnsh, resolvedPath);
    },
  } satisfies WasmFsApi;
}

export function writeKernelSource(module: EmscriptenModule, fs: WasmFsApi, kernel: KernelSource): string {
  if (typeof kernel === "string") {
    return kernel;
  }

  const resolved = resolveKernelPath(kernel.path);
  fs.writeFile(resolved, kernel.bytes);
  return resolved;
}

