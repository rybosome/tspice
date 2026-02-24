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

/** Create a high-level {@link SpiceKit} wrapper around a low-level {@link SpiceBackend}. */
export function createKit(cspice: SpiceBackend, options: CreateKitOptions = {}): SpiceKit {
  const { byteBackedKernelPaths } = options;

  return {
    ...createKernelKit(
      cspice,
      byteBackedKernelPaths ? { byteBackedKernelPaths } : {},
    ),
    ...createTimeKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),

    // Moved off `raw` onto `kit` (compat surface for higher-level tspice clients).
    spiceVersion: () => {
      try {
        return cspice.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("spiceVersion", error);
      }
    },

    readVirtualOutput: (output) => {
      try {
        return cspice.readVirtualOutput(output);
      } catch (error) {
        throw wrapSpiceError("readVirtualOutput", error);
      }
    },

    newIntCell: (size) => {
      try {
        return cspice.newIntCell(size);
      } catch (error) {
        throw wrapSpiceError("newIntCell", error);
      }
    },
    newDoubleCell: (size) => {
      try {
        return cspice.newDoubleCell(size);
      } catch (error) {
        throw wrapSpiceError("newDoubleCell", error);
      }
    },
    newCharCell: (size, length) => {
      try {
        return cspice.newCharCell(size, length);
      } catch (error) {
        throw wrapSpiceError("newCharCell", error);
      }
    },
    newWindow: (maxIntervals) => {
      try {
        return cspice.newWindow(maxIntervals);
      } catch (error) {
        throw wrapSpiceError("newWindow", error);
      }
    },

    freeCell: (cell) => {
      try {
        cspice.freeCell(cell);
      } catch (error) {
        throw wrapSpiceError("freeCell", error);
      }
    },
    freeWindow: (window) => {
      try {
        cspice.freeWindow(window);
      } catch (error) {
        throw wrapSpiceError("freeWindow", error);
      }
    },

    cellGeti: (cell, index) => {
      try {
        return cspice.cellGeti(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGeti", error);
      }
    },
    cellGetd: (cell, index) => {
      try {
        return cspice.cellGetd(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetd", error);
      }
    },
    cellGetc: (cell, index) => {
      try {
        return cspice.cellGetc(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetc", error);
      }
    },

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
