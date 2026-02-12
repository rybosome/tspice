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
  SpiceClientBuildResult,
  SpiceClientsBuilder,
  SpiceClientsFactory,
} from "./clients/spiceClients.js";
export { spiceClients } from "./clients/spiceClients.js";

export type {
  CreatePublicKernelsOptions,
  PublicKernelId,
  PublicKernelsBuilder,
} from "./kernels/publicKernels.js";
export { createPublicKernels, publicKernels } from "./kernels/publicKernels.js";

// Former `@rybosome/tspice/web` exports (now available at the root).
export type { SpiceTransport } from "./transport/types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "./transport/caching/withCaching.js";
export {
  MAX_KEY_LENGTH,
  MAX_KEY_SCAN,
  MAX_KEY_STRING_LENGTH,
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "./transport/caching/withCaching.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "./worker/transport/createWorkerTransport.js";
export { createWorkerTransport } from "./worker/transport/createWorkerTransport.js";

export { exposeTransportToWorker } from "./worker/transport/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "./worker/browser/createSpiceWorker.js";
export { createSpiceWorker } from "./worker/browser/createSpiceWorker.js";

export type { SpiceWorkerClient } from "./worker/browser/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "./worker/browser/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "./clients/createSpiceAsyncFromTransport.js";

export type { KernelPack, KernelPackKernel, LoadKernelPackOptions } from "./kernels/kernelPack.js";
export { loadKernelPack } from "./kernels/kernelPack.js";

