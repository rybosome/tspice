import type { KernelSource } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";
import { tspiceCall1Path } from "../codec/calls.js";

export type WasmFsApi = {
  writeFile(path: string, data: Uint8Array): void;
  loadKernel(path: string, data: Uint8Array): void;
};

export function resolveKernelPath(path: string): string {
  // We treat kernel paths as *virtual* WASM-FS paths under `/kernels`.
  //
  // Callers may pass a variety of forms (e.g. `foo.tls`, `./foo.tls`,
  // `/kernels/foo.tls`, `kernels//foo.tls`). Normalize all of them to a
  // canonical absolute path.
  //
  // Notes:
  // - We intentionally do not allow `..` path traversal.
  // - Multiple slashes and `.` segments are collapsed.
  const raw = path.replaceAll("\\", "/").trim();
  if (!raw) {
    throw new Error("Kernel path must be non-empty");
  }

  // Normalize to a relative virtual path first.
  let rel = raw;

  // Strip any leading slashes so `/foo` behaves like `foo`.
  rel = rel.replace(/^\/+/, "");

  // Strip leading `./` segments.
  while (rel.startsWith("./")) {
    rel = rel.slice(2);
  }

  // Avoid double-prefix when callers include a `kernels/` prefix.
  while (rel.startsWith("kernels/")) {
    rel = rel.replace(/^kernels\/+/, "");
  }

  const segments = rel.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === ".") {
      continue;
    }
    if (seg === "..") {
      throw new Error(`Invalid kernel path (.. not allowed): ${path}`);
    }
    out.push(seg);
  }

  if (out.length === 0) {
    throw new Error(`Invalid kernel path: ${path}`);
  }

  return `/kernels/${out.join("/")}`;
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
