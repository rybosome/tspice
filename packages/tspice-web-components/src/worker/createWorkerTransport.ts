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
    op: string;
    // These always run per-request cleanup before settling.
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    cleanup: () => void;
  };

  const pendingById = new Map<number, Pending>();
  // Requests with a received response that are awaiting next-macrotask
  // settlement. Keeping these separate from `pendingById` lets us remove a
  // request from the timeout/abort race immediately upon response receipt,
  // while still allowing `dispose()` (and worker errors) to deterministically
  // win before settlement.
  const settlingById = new Map<number, Pending>();
  const settleTimeoutById = new Map<number, ReturnType<typeof setTimeout>>();
  let nextId = 1;

  const formatRequestContext = (op: string, id: number): string => `(op=${op}, id=${id})`;

  const rejectAllPending = (getReason: (pending: Pending, id: number) => unknown): void => {
    // Cancel deferred settlement timers so they don't keep work queued after
    // we've already rejected the associated requests.
    for (const t of settleTimeoutById.values()) clearTimeout(t);
    settleTimeoutById.clear();

    for (const [id, pending] of pendingById) {
      pendingById.delete(id);
      pending.reject(getReason(pending, id)); // reject already cleans up
    }

    for (const [id, pending] of settlingById) {
      settlingById.delete(id);
      pending.reject(getReason(pending, id)); // reject already cleans up
    }
  };

  const onMessage = (ev: MessageEvent<unknown>): void => {
    const msg = ev.data as Partial<RpcResponse> | null | undefined;
    if (!msg || msg.type !== "tspice:response" || typeof msg.id !== "number") return;

    const id = msg.id;

    const pending = pendingById.get(id);
    if (!pending) return;

    // Remove immediately so a queued timeout handler can't win after we've
    // already received a legitimate response.
    pendingById.delete(id);

    // Clean up request-specific resources immediately (abort listeners, timers),
    // but defer settling to a macrotask so `dispose()` can deterministically win.
    pending.cleanup();

    // Track the deferred settlement so `dispose()` (and worker errors) can still
    // reject it before the next tick.
    settlingById.set(id, pending);

    const op = pending.op;

    // Extract response fields up-front so the deferred macrotask doesn't close
    // over the full `msg` payload.
    let kind: "resolve" | "reject";
    let value: unknown = undefined;
    let error: unknown = undefined;

    if (msg.ok === true) {
      if (!("value" in msg)) {
        kind = "reject";
        error = new Error(
          `Malformed worker response: ok=true but missing value ${formatRequestContext(op, id)}`,
        );
      } else {
        kind = "resolve";
        value = (msg as Extract<RpcResponse, { ok: true }>).value;
      }
    } else if (msg.ok === false) {
      if (!("error" in msg)) {
        kind = "reject";
        error = new Error(
          `Malformed worker response: ok=false but missing error ${formatRequestContext(op, id)}`,
        );
      } else {
        kind = "reject";
        error = deserializeError((msg as Extract<RpcResponse, { ok: false }>).error);
      }
    } else {
      kind = "reject";
      error = new Error(`Malformed worker response: missing ok flag ${formatRequestContext(op, id)}`);
    }

    const timeout = setTimeout(() => {
      settleTimeoutById.delete(id);
      if (settlingById.get(id) !== pending) return;
      settlingById.delete(id);

      if (disposed) {
        pending.reject(new Error(`Worker transport disposed ${formatRequestContext(op, id)}`));
        return;
      }

      if (kind === "resolve") {
        pending.resolve(value);
        return;
      }

      pending.reject(error);
    }, 0);

    settleTimeoutById.set(id, timeout);
  };

  const onError = (ev: ErrorEvent): void => {
    const message = ev.message || "Worker error";
    rejectAllPending(
      (pending, id) => new Error(`${message} ${formatRequestContext(pending.op, id)}`),
    );
  };

  const onMessageError = (_ev: MessageEvent<unknown>): void => {
    rejectAllPending(
      (pending, id) =>
        new Error(`Worker message deserialization failed ${formatRequestContext(pending.op, id)}`),
    );
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

    rejectAllPending((pending, id) =>
      new Error(`Worker transport disposed ${formatRequestContext(pending.op, id)}`),
    );

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
    const id = nextId++;
    if (disposed) throw new Error(`Worker transport disposed ${formatRequestContext(op, id)}`);

    const w = ensureWorker();

    const timeoutMs = requestOpts?.timeoutMs ?? opts.timeoutMs;
    const signal = requestOpts?.signal;

    return await new Promise<unknown>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let cleanedUp = false;
      let onAbort: (() => void) | undefined;

      const cleanup = (): void => {
        if (cleanedUp) return;
        cleanedUp = true;

        if (timeout !== undefined) {
          clearTimeout(timeout);
          timeout = undefined;
        }

        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      };

      const resolveAndCleanup = (value: unknown): void => {
        cleanup();
        resolve(value);
      };

      const rejectAndCleanup = (reason: unknown): void => {
        cleanup();
        reject(reason);
      };

      const pending: Pending = {
        op,
        resolve: resolveAndCleanup,
        reject: rejectAndCleanup,
        cleanup,
      };
      pendingById.set(id, pending);

      onAbort = (): void => {
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
          pending.reject(
            new Error(`Worker request timed out after ${timeoutMs}ms ${formatRequestContext(op, id)}`),
          );
        }, timeoutMs);
      }

      const msg: RpcRequest = { type: "tspice:request", id, op, args };
      try {
        w.postMessage(msg);
      } catch (err) {
        if (pendingById.get(id) === pending) pendingById.delete(id);

        const out = new Error(`Worker postMessage failed ${formatRequestContext(op, id)}`);
        (out as any).cause = err;
        pending.reject(out);
      }
    });
  };

  return {
    request,
    dispose,
  };
}
