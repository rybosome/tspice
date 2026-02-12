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

export { J2000 } from "./types.js";

export { SpiceError } from "./errors.js";

export { Mat3 } from "./kit/math/mat3.js";
export type { Spice, SpiceAsync, SpiceKit, SpiceSync } from "./kit/types/spice-types.js";
export type { CreateSpiceAsyncOptions, CreateSpiceOptions } from "./spice.js";
export { createSpice, createSpiceAsync } from "./spice.js";

export type {
  CreateSpiceClientsOptions,
  SpiceClientBuildResult,
  SpiceClientsBuilder,
  SpiceClientsFactory,
} from "./web/spiceClients.js";
export { createSpiceClients, spiceClients } from "./web/spiceClients.js";

export type {
  CreatePublicKernelsOptions,
  PublicKernelId,
  PublicKernelsBuilder,
} from "./web/kernels/publicKernels.js";
export { createPublicKernels, publicKernels } from "./web/kernels/publicKernels.js";

// Former `@rybosome/tspice/web` exports (now available at the root).
export type { SpiceTransport } from "./web/types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "./web/cache/withCaching.js";
export {
  MAX_KEY_LENGTH,
  MAX_KEY_SCAN,
  MAX_KEY_STRING_LENGTH,
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "./web/cache/withCaching.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "./web/worker/createWorkerTransport.js";
export { createWorkerTransport } from "./web/worker/createWorkerTransport.js";

export { exposeTransportToWorker } from "./web/worker/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "./web/worker/createSpiceWorker.js";
export { createSpiceWorker } from "./web/worker/createSpiceWorker.js";

export type { SpiceWorkerClient } from "./web/worker/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "./web/worker/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "./web/client/createSpiceAsyncFromTransport.js";

export type { KernelPack, KernelPackKernel, LoadKernelPackOptions } from "./web/kernels/kernelPack.js";
export { loadKernelPack } from "./web/kernels/kernelPack.js";

