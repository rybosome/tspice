import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import type { SpiceKit } from "../types/spice-types.js";

import { createFramesKit } from "./frames.js";
import { createKernelKit } from "./kernels.js";
import { createStateKit } from "./state.js";
import { createTimeKit } from "./time.js";

export function createKit(cspice: SpiceBackend): SpiceKit {
  return {
    ...createKernelKit(cspice),
    ...createTimeKit(cspice),
    ...createFramesKit(cspice),
    ...createStateKit(cspice),
  };
}
