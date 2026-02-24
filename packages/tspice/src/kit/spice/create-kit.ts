import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { SpiceKit } from "../types/spice-types.js";

import { createFramesKit } from "./frames.js";
import { createKernelKit } from "./kernels.js";
import { createStateKit } from "./state.js";
import { createTimeKit } from "./time.js";

type MovedRawHelperKey =
  | "spiceVersion"
  | "readVirtualOutput"
  | "newIntCell"
  | "newDoubleCell"
  | "newCharCell"
  | "newWindow"
  | "freeCell"
  | "freeWindow"
  | "cellGeti"
  | "cellGetd"
  | "cellGetc";

type RawHelperSource = Pick<SpiceBackend, MovedRawHelperKey>;

export type CreateKitOptions = {
  /**
   * Internal: tracks virtual kernel paths loaded from bytes so `kclear()` and
   * `unloadKernel()` can keep kit state in sync across backends.
   */
  byteBackedKernelPaths?: Set<string>;

  /**
   * Internal: source for helper methods intentionally hidden from the public
   * `spice.raw` surface but re-exposed on `spice.kit`.
   */
  rawHelperSource?: RawHelperSource;
};

/** Create a high-level {@link SpiceKit} wrapper around a low-level {@link SpiceBackend}. */
export function createKit(cspice: SpiceBackend, options: CreateKitOptions = {}): SpiceKit {
  const rawHelperSource = options.rawHelperSource ?? cspice;
  const movedHelpers: Pick<SpiceKit, MovedRawHelperKey> = {
    // Migration shims: helpers moved off `raw` onto `kit`.
    spiceVersion: () => {
      try {
        return cspice.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("spiceVersion", error);
      }
    },

    readVirtualOutput: (output) => {
      try {
        return rawHelperSource.readVirtualOutput(output);
      } catch (error) {
        throw wrapSpiceError("readVirtualOutput", error);
      }
    },

    newIntCell: (size) => {
      try {
        return rawHelperSource.newIntCell(size);
      } catch (error) {
        throw wrapSpiceError("newIntCell", error);
      }
    },
    newDoubleCell: (size) => {
      try {
        return rawHelperSource.newDoubleCell(size);
      } catch (error) {
        throw wrapSpiceError("newDoubleCell", error);
      }
    },
    newCharCell: (size, length) => {
      try {
        return rawHelperSource.newCharCell(size, length);
      } catch (error) {
        throw wrapSpiceError("newCharCell", error);
      }
    },
    newWindow: (maxIntervals) => {
      try {
        return rawHelperSource.newWindow(maxIntervals);
      } catch (error) {
        throw wrapSpiceError("newWindow", error);
      }
    },

    freeCell: (cell) => {
      try {
        return rawHelperSource.freeCell(cell);
      } catch (error) {
        throw wrapSpiceError("freeCell", error);
      }
    },
    freeWindow: (window) => {
      try {
        return rawHelperSource.freeWindow(window);
      } catch (error) {
        throw wrapSpiceError("freeWindow", error);
      }
    },

    cellGeti: (cell, index) => {
      try {
        return rawHelperSource.cellGeti(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGeti", error);
      }
    },
    cellGetd: (cell, index) => {
      try {
        return rawHelperSource.cellGetd(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetd", error);
      }
    },
    cellGetc: (cell, index) => {
      try {
        return rawHelperSource.cellGetc(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetc", error);
      }
    },
  };

  return {
    ...createKernelKit(
      cspice,
      options.byteBackedKernelPaths ? { byteBackedKernelPaths: options.byteBackedKernelPaths } : {},
    ),
    ...createTimeKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),
    ...movedHelpers,

    kclear: () => {
      try {
        cspice.kclear();
      } catch (error) {
        throw wrapSpiceError("kclear", error);
      }
    },
  };
}
