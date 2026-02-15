import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";
import { normalizeVirtualKernelPath } from "@rybosome/tspice-core";

import { wrapSpiceError } from "../../errors.js";

export type CreateKernelKitOptions = {
  /**
   * Internal: tracks virtual kernel paths loaded from bytes so callers can
   * unload kernels with flexible path forms (e.g. `/kernels/foo.tls`).
   */
  byteBackedKernelPaths?: Set<string>;
};

/** Create kernel load/unload helpers for a given backend (with virtual-path normalization). */
export function createKernelKit(
  cspice: SpiceBackend,
  options: CreateKernelKitOptions = {},
): {
  loadKernel(kernel: KernelSource): void;
  unloadKernel(path: string): void;
} {
  const byteBackedKernelPaths = options.byteBackedKernelPaths;

  return {
    loadKernel: (kernel) => {
      try {
        if (typeof kernel === "string") {
          cspice.furnsh(kernel);
          return;
        }

        const normalized = normalizeVirtualKernelPath(kernel.path);
        cspice.furnsh({ ...kernel, path: normalized });
        byteBackedKernelPaths?.add(normalized);
      } catch (error) {
        throw wrapSpiceError("loadKernel", error);
      }
    },

    unloadKernel: (path) => {
      try {
        // `kit.unloadKernel()` is intentionally for *virtual* kernel identifiers.
        // For backend-native unloading (e.g. OS filesystem paths), use `raw.unload()`.
        const normalized = normalizeVirtualKernelPath(path);
        try {
          cspice.unload(normalized);
        } finally {
          byteBackedKernelPaths?.delete(normalized);
        }
      } catch (error) {
        throw wrapSpiceError("unloadKernel", error);
      }
    },
  };
}
