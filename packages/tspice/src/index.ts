export type {
  KernelSource,
  Mat3ColMajor,
  Mat3RowMajor,
  SpiceBackend,
} from "@rybosome/tspice-backend-contract";

export {
  assertMat3ArrayLike9,
  isMat3ArrayLike9,
  brandMat3ColMajor,
  brandMat3RowMajor,
  isBrandedMat3ColMajor,
  isBrandedMat3RowMajor,
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
