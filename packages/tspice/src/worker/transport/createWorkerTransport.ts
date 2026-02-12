import type { SpiceTransport } from "../../transport/types.js";

import type { RpcDispose, RpcRequest, RpcResponse } from "../../transport/rpc/protocol.js";
import {
  deserializeError,
  tspiceRpcDisposeType,
  tspiceRpcRequestType,
  tspiceRpcResponseType,
} from "../../transport/rpc/protocol.js";
import { decodeRpcValue, encodeRpcValue } from "../../transport/rpc/valueCodec.js";
import { canQueueMacrotask, queueMacrotask } from "../../transport/rpc/taskScheduling.js";

export type WorkerLike = {
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: (ev: unknown) => void): void;
  removeEventListener(type: string, listener: (ev: unknown) => void): void;
  terminate(): void;
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
   * `queueMacrotask(...)`) so calling `dispose()` in the same tick
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

function createNoMacrotaskSchedulerError(): Error {
  return new Error(
    "Worker transport cannot schedule macrotask settlement (MessageChannel/setTimeout missing). " +
      "Refusing to settle responses synchronously because it would break dispose ordering guarantees.",
  );
}

/**
 * Create a `SpiceTransport` backed by a `Worker`.
 *
 * ## Macrotask settlement ordering
 *
 * Worker responses are resolved/rejected on a later macrotask (via
 * `queueMacrotask(...)`) so that calling `dispose()` in the same tick
 * deterministically wins.
 *
 * Implications:
 * - Requests never resolve/reject on the same tick a response is received.
 * - A response received in the current tick may be ignored if `dispose()` is
 *   called before the next tick.
 * - If no macrotask scheduler exists in the runtime (no `MessageChannel` and no `setTimeout`),
 *   the transport fails closed by rejecting requests rather than settling synchronously.
 */
export function createWorkerTransport(opts: {
  worker: WorkerLike | (() => WorkerLike);
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

  /**
   * Whether `dispose()` should post a `tspice:dispose` message to the worker.
   *
   * This is a global server cleanup signal.
   *
   * Defaults to `terminateOnDispose` so that owned workers are signaled, but
   * shared-worker clients do not accidentally request global cleanup unless
   * externally coordinated.
   */
  signalDispose?: boolean;
}): WorkerTransport {
  let worker: WorkerLike | undefined;
  // Retain a reference for best-effort dispose signaling even after terminal
  // teardown clears `worker`.
  let workerForDisposeSignal: WorkerLike | undefined;
  let disposed = false;
  let terminalError: Error | undefined;

  // If we ever discover we can't schedule a macrotask, we permanently fail
  // closed (reject) to avoid violating settlement ordering guarantees.
  let canScheduleMacrotask: boolean | undefined;

  const terminateOnDispose =
    opts.terminateOnDispose ?? (typeof opts.worker === "function" ? true : false);

  const signalDispose = opts.signalDispose ?? terminateOnDispose;

  let didSignalDispose = false;

  const signalDisposeOnce = (): void => {
    if (didSignalDispose) return;
    didSignalDispose = true;

    if (!signalDispose) return;

    const w = worker ?? workerForDisposeSignal;
    if (!w) return;

    try {
      const msg: RpcDispose = { type: tspiceRpcDisposeType };
      w.postMessage(msg);
    } catch {
      // ignore
    }
  };

  type Pending = {
    op: string;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    // Idempotent request cleanup (abort listeners, timeout timers, etc).
    cleanup: () => void;
    // Helper for paths that must reject *and* run cleanup.
    rejectAndCleanup: (reason: unknown) => void;
  };

  const pendingById = new Map<number, Pending>();

  type QueuedSettlement = {
    pending: Pending;
    kind: "resolve" | "reject";
    value: unknown;
    error: unknown;
  };

  // Requests with a received response that are awaiting next-macrotask
  // settlement. Keeping these separate from `pendingById` lets us remove a
  // request from the timeout/abort race immediately upon response receipt,
  // while still allowing `dispose()` (and worker errors) to deterministically
  // win before settlement.
  const queuedSettlementById = new Map<number, QueuedSettlement>();

  // Whether a single macrotask has been queued to settle all currently-queued responses.
  let settlementQueued = false;

  let nextId = 1;

  const formatRequestContext = (op: string, id?: number): string =>
    id === undefined ? `(op=${op})` : `(op=${op}, id=${id})`;

  const ensureCanScheduleMacrotask = (): void => {
    if (canScheduleMacrotask === undefined) {
      // Fail fast before posting any messages if the runtime lacks a macrotask
      // scheduler.
      canScheduleMacrotask = canQueueMacrotask();
    }

    if (canScheduleMacrotask === false) {
      throw createNoMacrotaskSchedulerError();
    }
  };

  const rejectAllPending = (getReason: (pending: Pending, id: number) => unknown): void => {
    for (const [id, pending] of pendingById) {
      pendingById.delete(id);
      pending.rejectAndCleanup(getReason(pending, id));
    }

    // Queued settlements already ran `cleanup()` when their response was received.
    for (const [id, settlement] of Array.from(queuedSettlementById)) {
      queuedSettlementById.delete(id);

      const pending = settlement.pending;
      pending.reject(getReason(pending, id));
      // Explicitly drop response payload references to help GC.
      settlement.value = undefined;
      settlement.error = undefined;
    }
  };

  const terminalTeardown = (
    err: Error,
    opts?: {
      getReason?: (pending: Pending, id: number) => unknown;
      /**
       * If `terminateOnDispose` is enabled, defer termination by 1 macrotask.
       *
       * Used by `dispose()` so callers can observe a disposed transport before
       * the worker is torn down, and to give the optional `tspice:dispose`
       * postMessage (if enabled) a chance to be processed.
       */
      deferTerminate?: boolean;
    },
  ): void => {
    if (terminalError) return;
    terminalError = err;

    // Terminal teardown transitions the transport into a disposed state even if
    // the caller never explicitly invoked `dispose()`.
    disposed = true;

    // Prevent any future settlement work from being queued.
    settlementQueued = false;

    rejectAllPending(opts?.getReason ?? (() => err));

    // Prefer the latest live worker for any best-effort dispose signaling.
    if (worker) workerForDisposeSignal = worker;

    const w = worker;
    worker = undefined;
    if (!w) return;

    w.removeEventListener("message", onMessage);
    w.removeEventListener("error", onError);
    w.removeEventListener("messageerror", onMessageError);

    if (!terminateOnDispose) return;

    if (opts?.deferTerminate) {
      const ok = queueMacrotask(
        () => {
          try {
            w.terminate();
          } catch {
            // ignore
          }
        },
        { allowSyncFallback: false },
      );

      // No scheduler: explicitly fall back to a synchronous terminate so we
      // don't leave an owned worker running.
      if (!ok) {
        try {
          w.terminate();
        } catch {
          // ignore
        }
      }

      return;
    }

    try {
      w.terminate();
    } catch {
      // ignore
    }
  };

  const hardFailNoMacrotaskScheduler = (err: Error): void => {
    // Permanently fail closed.
    canScheduleMacrotask = false;

    if (terminalError) return;

    // Best-effort: if configured, attempt to notify the worker to dispose any
    // server-side resources *before* we remove listeners/terminate.
    signalDisposeOnce();

    terminalTeardown(err);
  };

  const flushQueuedSettlements = (): void => {
    settlementQueued = false;

    for (const [id, settlement] of Array.from(queuedSettlementById)) {
      queuedSettlementById.delete(id);

      const pending = settlement.pending;
      const op = pending.op;
      const kind = settlement.kind;

      // Drop references to response payloads as soon as possible.
      let value: unknown = settlement.value;
      let error: unknown = settlement.error;
      settlement.value = undefined;
      settlement.error = undefined;

      if (disposed) {
        pending.reject(new Error(`Worker transport disposed ${formatRequestContext(op, id)}`));
        continue;
      }

      if (kind === "resolve") {
        pending.resolve(value);
        value = undefined;
        continue;
      }

      pending.reject(error);
      error = undefined;
    }
  };

  const scheduleSettlementMacrotask = (): void => {
    if (settlementQueued) return;
    settlementQueued = true;

    const ok = queueMacrotask(flushQueuedSettlements, { allowSyncFallback: false });
    if (ok) {
      canScheduleMacrotask = true;
      return;
    }

    // No macrotask scheduler available. Hard-fail and tear down rather than
    // settling synchronously and violating ordering guarantees.
    hardFailNoMacrotaskScheduler(createNoMacrotaskSchedulerError());
  };

  const onMessage = (ev: unknown): void => {
    const msg = (ev as { data?: unknown } | null | undefined)?.data as
      | Partial<RpcResponse>
      | null
      | undefined;
    if (!msg || msg.type !== tspiceRpcResponseType || typeof msg.id !== "number") return;

    const id = msg.id;

    const pending = pendingById.get(id);
    if (!pending) return;

    // Remove immediately so a queued timeout handler can't win after we've
    // already received a legitimate response.
    pendingById.delete(id);

    // Clean up request-specific resources immediately (abort listeners, timers),
    // but defer settling to a macrotask so `dispose()` can deterministically win.
    pending.cleanup();

    // If we already know we can't schedule macrotasks, reject immediately.
    if (canScheduleMacrotask === false) {
      pending.reject(createNoMacrotaskSchedulerError());
      return;
    }

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
        value = decodeRpcValue((msg as Extract<RpcResponse, { ok: true }>).value);
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

    queuedSettlementById.set(id, { pending, kind, value, error });
    scheduleSettlementMacrotask();
  };

  const onError = (ev: unknown): void => {
    let message: string | undefined;
    try {
      message = (ev as { message?: unknown } | null | undefined)?.message as string | undefined;
    } catch {
      // ignore
    }

    const safeMessage = typeof message === "string" && message.length > 0 ? message : "Worker error";
    terminalTeardown(new Error(safeMessage), {
      getReason: (pending, id) => new Error(`${safeMessage} ${formatRequestContext(pending.op, id)}`),
    });
  };

  const onMessageError = (_ev: unknown): void => {
    const err = new Error("Worker message deserialization failed");
    terminalTeardown(err, {
      getReason: (pending, id) =>
        new Error(`Worker message deserialization failed ${formatRequestContext(pending.op, id)}`),
    });
  };

  const ensureWorker = (): WorkerLike => {
    ensureCanScheduleMacrotask();

    if (!worker) {
      // Lazily construct/attach so transports can be created in environments
      // that don't immediately support `Worker`.
      try {
        worker = typeof opts.worker === "function" ? opts.worker() : opts.worker;
      } catch (err) {
        const out = new Error("Failed to create Worker");
        (out as Error & { cause?: unknown }).cause = err;
        throw out;
      }

      workerForDisposeSignal = worker;

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
    }

    return worker;
  };

  const dispose = (): void => {
    // Idempotent. Even if we're already in a terminal state, callers should be
    // able to invoke `dispose()` and still get a best-effort dispose signal.
    if (disposed) {
      signalDisposeOnce();
      return;
    }
    disposed = true;

    // Best-effort: tell the worker it should dispose any server-side resources.
    //
    // This is intentionally opt-in for shared workers; `tspice:dispose` is a
    // global cleanup signal and may affect other clients.
    signalDisposeOnce();

    if (terminalError) return;

    terminalTeardown(new Error("Worker transport disposed"), {
      getReason: (pending, id) =>
        new Error(`Worker transport disposed ${formatRequestContext(pending.op, id)}`),
      deferTerminate: true,
    });
  };

  const request = async (
    op: string,
    args: unknown[],
    requestOpts?: WorkerTransportRequestOptions,
  ): Promise<unknown> => {
    if (terminalError) throw terminalError;
    if (disposed) throw new Error(`Worker transport disposed ${formatRequestContext(op)}`);
    if (canScheduleMacrotask === false) throw createNoMacrotaskSchedulerError();

    const id = nextId++;

    const w = ensureWorker();

    const timeoutMs = requestOpts?.timeoutMs ?? opts.timeoutMs;
    const signal = requestOpts?.signal;

    if (timeoutMs !== undefined && timeoutMs > 0) {
      const hasTimers =
        typeof setTimeout === "function" && typeof clearTimeout === "function";
      if (!hasTimers) {
        throw new Error(
          `Worker request timeoutMs=${timeoutMs} requires timers (setTimeout/clearTimeout) ${formatRequestContext(op, id)}`,
        );
      }
    }

    return await new Promise<unknown>((resolve, reject) => {
      let requestTimeout: ReturnType<typeof setTimeout> | undefined;
      // Cleanup is intentionally idempotent. It may be called from multiple
      // paths (timeout, abort, response receipt, or dispose()) depending on
      // ordering.
      let didCleanup = false;
      let onAbort: (() => void) | undefined;

      const cleanup = (): void => {
        if (didCleanup) return;
        didCleanup = true;

        if (requestTimeout !== undefined) {
          clearTimeout(requestTimeout);
          requestTimeout = undefined;
        }

        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      };

      const rejectAndCleanup = (reason: unknown): void => {
        cleanup();
        reject(reason);
      };

      const pending: Pending = {
        op,
        resolve,
        reject,
        cleanup,
        rejectAndCleanup,
      };
      pendingById.set(id, pending);

      onAbort = (): void => {
        if (pendingById.get(id) !== pending) return;
        pendingById.delete(id);
        pending.rejectAndCleanup(createAbortError());
      };

      if (signal) {
        if (signal.aborted) {
          pendingById.delete(id);
          pending.rejectAndCleanup(createAbortError());
          return;
        }

        signal.addEventListener("abort", onAbort);
      }

      if (timeoutMs !== undefined && timeoutMs > 0) {
        requestTimeout = setTimeout(() => {
          if (pendingById.get(id) !== pending) return;
          pendingById.delete(id);
          pending.rejectAndCleanup(
            new Error(
              `Worker request timed out after ${timeoutMs}ms ${formatRequestContext(op, id)}`,
            ),
          );
        }, timeoutMs);
      }

      const msg: RpcRequest = { type: tspiceRpcRequestType, id, op, args };
      try {
        w.postMessage({ ...msg, args: args.map(encodeRpcValue) });
      } catch (err) {
        if (pendingById.get(id) === pending) pendingById.delete(id);

        const out = new Error(`Worker postMessage failed ${formatRequestContext(op, id)}`);
        (out as Error & { cause?: unknown }).cause = err;
        pending.rejectAndCleanup(out);
      }
    });
  };

  return {
    request,
    dispose,
  };
}
