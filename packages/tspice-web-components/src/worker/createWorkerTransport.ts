import type { SpiceTransport } from "../types.js";

type RpcRequest = {
  type: "tspice:request";
  id: number;
  op: string;
  args: unknown[];
};

type SerializedError = {
  message: string;
  name?: string;
  stack?: string;
};

type RpcResponse =
  | {
      type: "tspice:response";
      id: number;
      ok: true;
      value: unknown;
    }
  | {
      type: "tspice:response";
      id: number;
      ok: false;
      error: SerializedError;
    };

export type WorkerTransportRequestOptions = {
  /** Abort waiting for a response and clean up pending state. */
  signal?: AbortSignal;
  /** Override the transport's default timeout for this request. */
  timeoutMs?: number;
};

export type WorkerTransport = Omit<SpiceTransport, "request"> & {
  /**
   * Send an RPC request to the worker.
   *
   * Note: Worker responses are always settled on a later macrotask (via
   * `setTimeout(..., 0)`) so calling `dispose()` in the same tick
   * deterministically wins.
   */
  request(
    op: string,
    args: unknown[],
    opts?: WorkerTransportRequestOptions,
  ): Promise<unknown>;
  /**
   * Remove listeners and reject all pending requests.
   *
   * If `terminateOnDispose` is enabled, also calls `worker.terminate()`.
   */
  dispose(): void;
};

function deserializeError(err: unknown): Error {
  if (err && typeof err === "object") {
    const e = err as Partial<SerializedError>;
    const out = new Error(typeof e.message === "string" ? e.message : "Worker request failed");
    if (typeof e.name === "string") out.name = e.name;
    if (typeof e.stack === "string") out.stack = e.stack;
    return out;
  }

  return new Error(typeof err === "string" ? err : "Worker request failed");
}

function createAbortError(): Error {
  // DOMException is the most accurate in browser contexts, but isn't guaranteed
  // to exist in all runtimes (e.g. some test environments).
  try {
    return new DOMException("Aborted", "AbortError");
  } catch {
    const err = new Error("Aborted");
    err.name = "AbortError";
    return err;
  }
}

/**
 * Create a `SpiceTransport` backed by a `Worker`.
 *
 * ## Macrotask settlement ordering
 *
 * Worker responses are resolved/rejected on a later macrotask (via
 * `setTimeout(..., 0)`) so that calling `dispose()` in the same tick
 * deterministically wins.
 *
 * Implications:
 * - Requests never resolve/reject on the same tick a response is received.
 * - A response received in the current tick may be ignored if `dispose()` is
 *   called before the next tick.
 */
export function createWorkerTransport(opts: {
  worker: Worker | (() => Worker);
  /** Default request timeout (ms). Use <= 0 or `undefined` to disable. */
  timeoutMs?: number;
  /**
   * Whether `dispose()` should call `worker.terminate()`.
   *
   * Defaults to `true` when `worker` is a factory function (since the transport
   * likely owns the worker), and `false` when an existing worker instance is
   * passed in.
   */
  terminateOnDispose?: boolean;
}): WorkerTransport {
  let worker: Worker | undefined;
  let disposed = false;

  const terminateOnDispose =
    opts.terminateOnDispose ?? (typeof opts.worker === "function" ? true : false);

  type Pending = {
    // These always run per-request cleanup before settling.
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    cleanup: () => void;
  };

  const pendingById = new Map<number, Pending>();
  let nextId = 1;

  const rejectAllPending = (reason: unknown): void => {
    for (const [id, pending] of pendingById) {
      // cleanup() is idempotent; call it explicitly so it's clear that every
      // request is cleaned up even though `pending.reject()` also cleans up.
      pending.cleanup();
      pendingById.delete(id);
      pending.reject(reason);
    }
  };

  const onMessage = (ev: MessageEvent<unknown>): void => {
    const msg = ev.data as Partial<RpcResponse> | null | undefined;
    if (!msg || msg.type !== "tspice:response" || typeof msg.id !== "number") return;

    const id = msg.id;

    const pending = pendingById.get(id);
    if (!pending) return;

    // Clean up request-specific resources immediately (abort listeners, timers),
    // but defer settling to a macrotask so `dispose()` can deterministically win.
    pending.cleanup();

    setTimeout(() => {
      if (pendingById.get(id) !== pending) return;
      pendingById.delete(id);

      if (msg.ok === true) {
        pending.resolve((msg as Extract<RpcResponse, { ok: true }>).value);
        return;
      }

      const err = deserializeError((msg as Extract<RpcResponse, { ok: false }>).error);
      pending.reject(err);
    }, 0);
  };

  const onError = (ev: ErrorEvent): void => {
    const err = new Error(ev.message || "Worker error");
    rejectAllPending(err);
  };

  const onMessageError = (_ev: MessageEvent<unknown>): void => {
    const err = new Error("Worker message deserialization failed");
    rejectAllPending(err);
  };

  const ensureWorker = (): Worker => {
    if (!worker) {
      worker = typeof opts.worker === "function" ? opts.worker() : opts.worker;

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
    }

    return worker;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    rejectAllPending(new Error("Worker transport disposed"));

    if (!worker) return;

    worker.removeEventListener("message", onMessage);
    worker.removeEventListener("error", onError);
    worker.removeEventListener("messageerror", onMessageError);

    if (terminateOnDispose) worker.terminate();
    worker = undefined;
  };

  const request = async (
    op: string,
    args: unknown[],
    requestOpts?: WorkerTransportRequestOptions,
  ): Promise<unknown> => {
    if (disposed) throw new Error("Worker transport disposed");

    const id = nextId++;
    const w = ensureWorker();

    const timeoutMs = requestOpts?.timeoutMs ?? opts.timeoutMs;
    const signal = requestOpts?.signal;

    return await new Promise<unknown>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let cleanedUp = false;

      const cleanup = (): void => {
        if (cleanedUp) return;
        cleanedUp = true;

        if (timeout !== undefined) {
          clearTimeout(timeout);
          timeout = undefined;
        }

        if (signal) signal.removeEventListener("abort", onAbort);
      };

      const resolveAndCleanup = (value: unknown): void => {
        cleanup();
        resolve(value);
      };

      const rejectAndCleanup = (reason: unknown): void => {
        cleanup();
        reject(reason);
      };

      const pending: Pending = { resolve: resolveAndCleanup, reject: rejectAndCleanup, cleanup };
      pendingById.set(id, pending);

      const onAbort = (): void => {
        if (pendingById.get(id) !== pending) return;
        pendingById.delete(id);
        pending.reject(createAbortError());
      };

      if (signal) {
        if (signal.aborted) {
          pendingById.delete(id);
          pending.reject(createAbortError());
          return;
        }

        signal.addEventListener("abort", onAbort);
      }

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timeout = setTimeout(() => {
          if (pendingById.get(id) !== pending) return;
          pendingById.delete(id);
          pending.reject(new Error(`Worker request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      const msg: RpcRequest = { type: "tspice:request", id, op, args };
      try {
        w.postMessage(msg);
      } catch (err) {
        if (pendingById.get(id) === pending) pendingById.delete(id);
        pending.reject(err);
      }
    });
  };

  return {
    request,
    dispose,
  };
}
