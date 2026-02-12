export type { SpiceTransport } from "../transport/types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "../transport/caching/withCaching.js";
export {
  MAX_KEY_LENGTH,
  MAX_KEY_SCAN,
  MAX_KEY_STRING_LENGTH,
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "../transport/caching/withCaching.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "../worker/transport/createWorkerTransport.js";
export { createWorkerTransport } from "../worker/transport/createWorkerTransport.js";

export { exposeTransportToWorker } from "../worker/transport/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "../worker/browser/createSpiceWorker.js";
export { createSpiceWorker } from "../worker/browser/createSpiceWorker.js";

export type { SpiceWorkerClient } from "../worker/browser/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "../worker/browser/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "../clients/createSpiceAsyncFromTransport.js";

export type { KernelPack, KernelPackKernel, LoadKernelPackOptions } from "../kernels/kernelPack.js";
export { loadKernelPack } from "../kernels/kernelPack.js";

export type {
  CreatePublicKernelsOptions,
  PublicKernelId,
  PublicKernelsBuilder,
} from "../kernels/publicKernels.js";
export { createPublicKernels, publicKernels } from "../kernels/publicKernels.js";

export type { CreateSpiceClientsOptions, SpiceClientsBuilder, SpiceClientsFactory } from "../clients/spiceClients.js";
export { createSpiceClients, spiceClients } from "../clients/spiceClients.js";
