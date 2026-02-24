import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { wrapSpiceError } from "../../errors.js";

/** Create file-I/O helpers for a given backend. */
export function createFileIoKit(cspice: SpiceBackend): Pick<SpiceBackend["kit"], "readVirtualOutput"> {
  return {
    readVirtualOutput: (output) => {
      try {
        return cspice.kit.readVirtualOutput(output);
      } catch (error) {
        throw wrapSpiceError("readVirtualOutput", error);
      }
    },
  };
}
