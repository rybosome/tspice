import type { SpiceAsync } from "@rybosome/tspice";

import type { SpiceTransport } from "../types.js";
import { createSpiceAsyncFromTransport } from "../client/createSpiceAsyncFromTransport.js";

import { createWorkerTransport, type WorkerTransport } from "./createWorkerTransport.js";
import { createSpiceWorker } from "./createSpiceWorker.js";

export type SpiceWorkerClient<TTransport extends SpiceTransport = WorkerTransport> = {
  worker: Worker;
  /** The underlying request/response RPC transport (always a WorkerTransport). */
  baseTransport: WorkerTransport;
  /** The transport after applying `wrapTransport` (e.g. `withCaching`). */
  transport: TTransport;
  /** A `SpiceAsync` client backed by `transport`. */
  spice: SpiceAsync;
  /** Dispose wrapper transport (if any) and the worker transport. */
  dispose: () => void;
};

export function createSpiceWorkerClient<TTransport extends SpiceTransport = WorkerTransport>(opts?: {
  /**
   * Pass an existing Worker or a factory to create one.
   *
   * Defaults to `() => createSpiceWorker()`.
   */
  worker?: Worker | (() => Worker);
  /** Default request timeout forwarded to `createWorkerTransport`. */
  timeoutMs?: number;
  /** Forwarded to `createWorkerTransport`. Defaults to `true` when `worker` is a factory. */
  terminateOnDispose?: boolean;
  /** Optional transport wrapper (e.g. `withCaching`). */
  wrapTransport?: (t: WorkerTransport) => TTransport;
}): SpiceWorkerClient<TTransport> {
  const workerInput = opts?.worker ?? (() => createSpiceWorker());
  const worker = typeof workerInput === "function" ? workerInput() : workerInput;

  const terminateOnDispose =
    opts?.terminateOnDispose ?? (typeof workerInput === "function" ? true : false);

  const baseTransport = createWorkerTransport({
    worker,
    ...(opts?.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }),
    terminateOnDispose,
  });

  const transport = opts?.wrapTransport
    ? opts.wrapTransport(baseTransport)
    : (baseTransport as unknown as TTransport);

  const spice = createSpiceAsyncFromTransport(transport);

  const dispose = (): void => {
    // If a wrapper transport supports cleanup, run it before disposing the
    // underlying worker transport.
    if (transport !== (baseTransport as unknown as TTransport)) {
      (transport as any)?.dispose?.();
    }

    baseTransport.dispose();
  };

  return {
    worker,
    baseTransport,
    transport,
    spice,
    dispose,
  };
}
