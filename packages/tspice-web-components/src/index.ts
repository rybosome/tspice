export type { SpiceTransport } from "./types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "./cache/withCaching.js";
export {
  MAX_KEY_SCAN,
  defaultSpiceCacheKey,
  isCachingTransport,
  withCaching,
} from "./cache/withCaching.js";

export type {
  WorkerTransport,
  WorkerTransportRequestOptions,
  WorkerLike,
} from "./worker/createWorkerTransport.js";
export { createWorkerTransport } from "./worker/createWorkerTransport.js";

export { exposeTransportToWorker } from "./worker/exposeTransportToWorker.js";

export { createSpiceWorker } from "./worker/createSpiceWorker.js";
export type { SpiceWorkerClient } from "./worker/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "./worker/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "./client/createSpiceAsyncFromTransport.js";
