// Re-export worker + transport utilities from the web implementation.

export type { SpiceTransport } from "../web/types.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "../web/worker/createWorkerTransport.js";
export { createWorkerTransport } from "../web/worker/createWorkerTransport.js";

export { exposeTransportToWorker } from "../web/worker/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "../web/worker/createSpiceWorker.js";
export { createSpiceWorker } from "../web/worker/createSpiceWorker.js";

export type { SpiceWorkerClient } from "../web/worker/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "../web/worker/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "../web/client/createSpiceAsyncFromTransport.js";
