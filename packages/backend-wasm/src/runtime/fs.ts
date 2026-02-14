import type { KernelSource } from "@rybosome/tspice-backend-contract";
import { normalizeVirtualKernelPath } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";
import { tspiceCall1Path } from "../codec/calls.js";

export type WasmFsApi = {
  writeFile(path: string, data: Uint8Array): void;
  loadKernel(path: string, data: Uint8Array): void;
};

/** Normalize and validate a virtual kernel path for the WASM FS (under `/kernels`). */
export function resolveKernelPath(path: string): string {
  const raw = path.trim();
  if (!raw) {
    throw new Error("Kernel path must be non-empty");
  }

  // Fail fast for common non-virtual path forms. This improves debuggability for
  // consumers who accidentally pass OS paths/URLs to the WASM backend.
  //
  // Note: `/kernels/...` is an allowed virtual path form.
  if (
    /^[a-zA-Z]+:/.test(raw) || // urls, `file:`, Windows drive letters, etc.
    raw.startsWith("//") ||
    raw.startsWith("\\\\") ||
    (raw.startsWith("/") && !raw.startsWith("/kernels/"))
  ) {
    throw new Error(`WASM kernel paths must be virtual ids (e.g. "naif0012.tls"), not OS paths/URLs: ${path}`);
  }

  // We treat kernel paths as *virtual* WASM-FS paths under `/kernels`.
  // Normalize to a canonical absolute path.
  return `/kernels/${normalizeVirtualKernelPath(raw)}`;
}

/** Create a minimal WASM-FS facade for writing files and loading kernels via `furnsh`. */
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

/**
 * Write a {@link KernelSource} into the WASM FS (if needed) and return the path to load.
 */
export function writeKernelSource(module: EmscriptenModule, fs: WasmFsApi, kernel: KernelSource): string {
  if (typeof kernel === "string") {
    return kernel;
  }

  const resolved = resolveKernelPath(kernel.path);
  fs.writeFile(resolved, kernel.bytes);
  return resolved;
}

