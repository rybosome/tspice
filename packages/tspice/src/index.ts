export type {
  BackendKind,
  KernelSource,
  Mat3ColMajor,
  Mat3RowMajor,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";

export type { CreateBackendOptions } from "./backend.js";
export { createBackend } from "./backend.js";

export type {
  AberrationCorrection,
  FrameName,
  GetStateArgs,
  SpiceTime,
  StateVector,
  Vec3,
  Vec6,
} from "./types.js";

export { SpiceError } from "./errors.js";

export { Mat3 } from "./kit/math/mat3.js";
export type { Spice, SpiceKit } from "./kit/types/spice-types.js";
export type { CreateSpiceOptions } from "./spice.js";
export { createSpice } from "./spice.js";
