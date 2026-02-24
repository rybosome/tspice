import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { SpiceKit } from "../types/spice-types.js";

import { createCellsWindowsKit } from "./cells-windows.js";
import { createFileIoKit } from "./file-io.js";
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

/** Create a high-level {@link SpiceKit} wrapper around a low-level {@link SpiceBackend}. */
export function createKit(cspice: SpiceBackend, options: CreateKitOptions = {}): SpiceKit {
  const { byteBackedKernelPaths } = options;

  return {
    ...createKernelKit(
      cspice,
      byteBackedKernelPaths ? { byteBackedKernelPaths } : {},
    ),
    ...createTimeKit(cspice),
    ...createFileIoKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),
    ...createCellsWindowsKit(cspice),

    kclear: () => {
      try {
        cspice.kclear();
      } catch (error) {
        throw wrapSpiceError("kclear", error);
      } finally {
        byteBackedKernelPaths?.clear();
      }
    },
  };
}
