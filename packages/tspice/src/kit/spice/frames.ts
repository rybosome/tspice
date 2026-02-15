import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";
import type { FrameName, SpiceTime } from "../../types.js";
import { Mat3 } from "../math/mat3.js";

/** Create frame helpers (pxform wrappers) for a given backend. */
export function createFramesKit(cspice: SpiceBackend): {
  frameTransform(from: FrameName, to: FrameName, et: SpiceTime): Mat3;
} {
  return {
    frameTransform: (from, to, et) => {
      try {
        return Mat3.fromRowMajor(cspice.pxform(from, to, et));
      } catch (error) {
        throw wrapSpiceError("frameTransform", error);
      }
    },
  };
}
