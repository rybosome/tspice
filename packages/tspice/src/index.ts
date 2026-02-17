// NOTE: This file is the *only* public entrypoint for the published
// `@rybosome/tspice` package.
//
// Keep this surface area intentionally small (see issue #444).

// Re-exported contract types/helpers that are part of the public API.
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

// Core types/constants.
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

// Math + kit types.
export { Mat3 } from "./kit/math/mat3.js";
export type { Spice, SpiceAsync, SpiceKit, SpiceSync } from "./kit/types/spice-types.js";

export { spiceClients } from "./clients/spiceClients.js";
export type {
  SpiceClientBuildResult,
  SpiceClientsBuilder,
  SpiceClientsWebWorkerOptions,
} from "./clients/spiceClients.js";

// Types required to configure the `spiceClients` builder and use its outputs.
export type { CreateSpiceAsyncOptions, CreateSpiceOptions } from "./spice.js";
export type { WithCachingOptions } from "./transport/caching/withCaching.js";
export { kernels } from "./kernels/kernels.js";
export type {
  KernelsNaifOptions,
  NaifKernelCatalog,
  KernelsCustomOptions,
  CustomKernelCatalog,
  CustomKernelEntry,
  CustomKernelPick,
  TspiceKernelCatalog,
  TspiceKernelId,
} from "./kernels/kernels.js";

export type { NaifKernelId } from "./kernels/naifKernelId.js";
export type { FetchLike, KernelPack, KernelPackKernel } from "./kernels/kernelPack.js";
