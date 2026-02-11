export type { SpiceTransport } from "./types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "./cache/withCaching.js";
export {
  MAX_KEY_LENGTH,
  MAX_KEY_SCAN,
  MAX_KEY_STRING_LENGTH,
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "./cache/withCaching.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "./worker/createWorkerTransport.js";
export { createWorkerTransport } from "./worker/createWorkerTransport.js";

export { exposeTransportToWorker } from "./worker/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "./worker/createSpiceWorker.js";
export { createSpiceWorker } from "./worker/createSpiceWorker.js";

export type { SpiceWorkerClient } from "./worker/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "./worker/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "./client/createSpiceAsyncFromTransport.js";

export type { KernelPack, KernelPackKernel, LoadKernelPackOptions } from "./kernels/kernelPack.js";
export { loadKernelPack } from "./kernels/kernelPack.js";

export type {
  CreatePublicKernelsOptions,
  PublicKernelId,
  PublicKernelsBuilder,
} from "./kernels/publicKernels.js";
export { createPublicKernels, publicKernels } from "./kernels/publicKernels.js";

export type { CreateSpiceClientsOptions, SpiceClientsBuilder, SpiceClientsFactory } from "./spiceClients.js";
export { createSpiceClients, spiceClients } from "./spiceClients.js";
