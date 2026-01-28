export type {
  BackendKind,
  KernelSource,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";

export type { CreateBackendOptions } from "./backend.js";
export { createBackend } from "./backend.js";

export type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  Mat3,
  SpiceTime,
  StateVector,
  Vec3,
  Vec6,
} from "./types.js";

export { SpiceError } from "./errors.js";

export type { Spice, SpicePrimitive, SpiceTools } from "./spice-types.js";
export type { CreateSpiceOptions } from "./spice.js";
export { createSpice } from "./spice.js";
