import type { SpiceBackend } from "@rybosome/tspice-backend-contract";
import type { SpiceKitCompatHelpers } from "@rybosome/tspice-core";

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

  /**
   * Optional backend-specific compat helpers that are intentionally not exposed
   * on `SpiceBackend` / `spice.raw`, but remain available via `spice.kit`.
   */
  compatHelpers?: Partial<SpiceKitCompatHelpers>;
};

function requireCompatHelper<K extends keyof SpiceKitCompatHelpers>(
  compat: Partial<SpiceKitCompatHelpers>,
  name: K,
): SpiceKitCompatHelpers[K] {
  const value = compat[name];
  if (typeof value !== "function") {
    throw new Error(
      `kit.${String(name)}() is unavailable for this backend instance (compat helper not provided)`,
    );
  }
  return value as SpiceKitCompatHelpers[K];
}

/** Create a high-level {@link SpiceKit} wrapper around a low-level {@link SpiceBackend}. */
export function createKit(cspice: SpiceBackend, options: CreateKitOptions = {}): SpiceKit {
  const compat = options.compatHelpers ?? (cspice as Partial<SpiceKitCompatHelpers>);

  return {
    ...createKernelKit(
      cspice,
      options.byteBackedKernelPaths ? { byteBackedKernelPaths: options.byteBackedKernelPaths } : {},
    ),
    ...createTimeKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),

    // Strict/fast migration shims: moved off `raw` onto `kit`.
    spiceVersion: () => {
      try {
        // Intentionally canonicalized to the 1:1 raw analogue.
        return cspice.tkvrsn("TOOLKIT");
      } catch (error) {
        throw wrapSpiceError("spiceVersion", error);
      }
    },

    readVirtualOutput: (output) => {
      try {
        return requireCompatHelper(compat, "readVirtualOutput")(output);
      } catch (error) {
        throw wrapSpiceError("readVirtualOutput", error);
      }
    },

    newIntCell: (size) => {
      try {
        return requireCompatHelper(compat, "newIntCell")(size);
      } catch (error) {
        throw wrapSpiceError("newIntCell", error);
      }
    },
    newDoubleCell: (size) => {
      try {
        return requireCompatHelper(compat, "newDoubleCell")(size);
      } catch (error) {
        throw wrapSpiceError("newDoubleCell", error);
      }
    },
    newCharCell: (size, length) => {
      try {
        return requireCompatHelper(compat, "newCharCell")(size, length);
      } catch (error) {
        throw wrapSpiceError("newCharCell", error);
      }
    },
    newWindow: (maxIntervals) => {
      try {
        return requireCompatHelper(compat, "newWindow")(maxIntervals);
      } catch (error) {
        throw wrapSpiceError("newWindow", error);
      }
    },

    freeCell: (cell) => {
      try {
        return requireCompatHelper(compat, "freeCell")(cell);
      } catch (error) {
        throw wrapSpiceError("freeCell", error);
      }
    },
    freeWindow: (window) => {
      try {
        return requireCompatHelper(compat, "freeWindow")(window);
      } catch (error) {
        throw wrapSpiceError("freeWindow", error);
      }
    },

    cellGeti: (cell, index) => {
      try {
        return requireCompatHelper(compat, "cellGeti")(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGeti", error);
      }
    },
    cellGetd: (cell, index) => {
      try {
        return requireCompatHelper(compat, "cellGetd")(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetd", error);
      }
    },
    cellGetc: (cell, index) => {
      try {
        return requireCompatHelper(compat, "cellGetc")(cell, index);
      } catch (error) {
        throw wrapSpiceError("cellGetc", error);
      }
    },

    kclear: () => {
      try {
        cspice.kclear();
      } catch (error) {
        throw wrapSpiceError("kclear", error);
      }
    },
  };
}
