import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { SpiceKit } from "../types/spice-types.js";

import { createFramesKit } from "./frames.js";
import { createKernelKit } from "./kernels.js";
import { createStateKit } from "./state.js";
import { createTimeKit } from "./time.js";

export type CreateKitOptions = {
  /**
   * Internal: tracks virtual kernel paths loaded from bytes so `kclear()` and
   * `unloadKernel()` can keep kit state in sync across backends.
   */
  byteBackedKernelPaths?: Set<string>;
};

export function createKit(cspice: SpiceBackend, options: CreateKitOptions = {}): SpiceKit {
  return {
    ...createKernelKit(cspice, { byteBackedKernelPaths: options.byteBackedKernelPaths }),
    ...createTimeKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),

    kclear: () => {
      try {
        cspice.kclear();
      } catch (error) {
        throw wrapSpiceError("kclear", error);
      }
    },
  };
}
