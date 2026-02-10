export type { SpiceTransport } from "./types.js";

export type {
  CachePolicy,
  CachingTransport,
  WithCachingOptions,
  WithCachingResult,
} from "./cache/withCaching.js";
export {
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

export { createSpiceAsyncFromTransport } from "./client/createSpiceAsyncFromTransport.js";
