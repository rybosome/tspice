import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";

export function createKernelKit(cspice: SpiceBackend): {
  loadKernel(kernel: KernelSource): void;
  unloadKernel(path: string): void;
} {
  return {
    loadKernel: (kernel) => {
      try {
        cspice.furnsh(kernel);
      } catch (error) {
        throw wrapSpiceError("loadKernel", error);
      }
    },

    unloadKernel: (path) => {
      try {
        cspice.unload(path);
      } catch (error) {
        throw wrapSpiceError("unloadKernel", error);
      }
    },
  };
}
