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
  BodyRef,
  FrameName,
  GetStateArgs,
  SpiceTime,
  StateVector,
  Vec3,
  Vec6,
} from "./types.js";

export { J2000 } from "./types.js";

export { SpiceError } from "./errors.js";

export { Mat3 } from "./kit/math/mat3.js";
export type { Spice, SpiceAsync, SpiceKit, SpiceSync } from "./kit/types/spice-types.js";
export type { CreateSpiceAsyncOptions, CreateSpiceOptions } from "./spice.js";
export { createSpice, createSpiceAsync } from "./spice.js";

export type {
  SpiceClientBuildResult,
  SpiceClientsBuilder,
  SpiceClientsWebWorkerOptions,
} from "./clients/spiceClients.js";
export { spiceClients } from "./clients/spiceClients.js";

export type {
  CustomKernelsBuilder,
  KernelsCustomOptions,
  KernelsNaifOptions,
  KernelsTspiceOptions,
  NaifKernelId,
  NaifKernelLeafPath,
  NaifKernelsBuilder,
  TspiceKernelsBuilder,
} from "./kernels/kernels.js";
export { kernels } from "./kernels/kernels.js";

export type {
  KernelPack,
  KernelPackKernel,
} from "./kernels/kernelPack.js";

export { resolveKernelUrl } from "./kernels/kernelPack.js";
