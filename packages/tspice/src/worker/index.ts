// Re-export worker + transport utilities.

export type { SpiceTransport } from "../transport/types.js";

export type {
  WorkerLike,
  WorkerTransport,
  WorkerTransportRequestOptions,
} from "./transport/createWorkerTransport.js";
export { createWorkerTransport } from "./transport/createWorkerTransport.js";

export { exposeTransportToWorker } from "./transport/exposeTransportToWorker.js";

export type { CreateSpiceWorkerOptions } from "./browser/createSpiceWorker.js";
export { createSpiceWorker } from "./browser/createSpiceWorker.js";

export type { SpiceWorkerClient } from "./browser/createSpiceWorkerClient.js";
export { createSpiceWorkerClient } from "./browser/createSpiceWorkerClient.js";

export { createSpiceAsyncFromTransport } from "../clients/createSpiceAsyncFromTransport.js";
