import type { SpiceAsync } from "@rybosome/tspice";

import type { SpiceTransport } from "../types.js";
import { createSpiceAsyncFromTransport } from "../client/createSpiceAsyncFromTransport.js";

import { createWorkerTransport, type WorkerTransport } from "./createWorkerTransport.js";
import { createSpiceWorker } from "./createSpiceWorker.js";

type DisposeFn = () => void | Promise<void>;

type DisposableLike = {
  dispose?: DisposeFn;
};

function getDisposeFn(value: unknown): DisposeFn | undefined {
  if (value === null) return undefined;
  const t = typeof value;
  if (t !== "object" && t !== "function") return undefined;

  const dispose = (value as DisposableLike).dispose;
  return typeof dispose === "function" ? dispose : undefined;
}

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  if (value === null) return false;
  const t = typeof value;
  if (t !== "object" && t !== "function") return false;

  return typeof (value as { then?: unknown }).then === "function";
}

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
  /**
   * Async dispose variant that awaits wrapper transport cleanup (if any) before
   * disposing the underlying worker transport.
   */
  disposeAsync: () => Promise<void>;
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

  let disposePromise: Promise<void> | undefined;

  const disposeAsync = (): Promise<void> => {
    if (disposePromise) return disposePromise;

    disposePromise = (async () => {
      try {
        // If a wrapper transport supports cleanup, run it before disposing the
        // underlying worker transport.
        if (transport !== (baseTransport as unknown as TTransport)) {
          const wrapperDispose = getDisposeFn(transport);
          if (wrapperDispose) {
            const result = wrapperDispose.call(transport as unknown as object);
            if (isPromiseLike(result)) await result;
          }
        }
      } finally {
        baseTransport.dispose();
      }
    })();

    return disposePromise;
  };

  const dispose = (): void => {
    // Fire-and-forget. Ensure we don't surface unhandled rejections if wrapper
    // cleanup fails.
    void disposeAsync().catch(() => {
      // ignore
    });
  };

  return {
    worker,
    baseTransport,
    transport,
    spice,
    dispose,
    disposeAsync,
  };
}
