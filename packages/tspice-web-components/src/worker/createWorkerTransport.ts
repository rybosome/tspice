import type { SpiceTransport } from "../types.js";

import type { RpcDispose, RpcRequest, RpcResponse } from "./rpcProtocol.js";
import {
  deserializeError,
  tspiceRpcDisposeType,
  tspiceRpcRequestType,
  tspiceRpcResponseType,
} from "./rpcProtocol.js";
import { decodeRpcValue, encodeRpcValue } from "./rpcValueCodec.js";

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

function queueMacrotask(fn: () => void): void {
  // Prefer MessageChannel when available. This schedules a real task boundary
  // without relying on timers, which makes it friendlier to fake-timer test
  // environments.
  try {
    if (typeof MessageChannel !== "undefined") {
      const { port1, port2 } = new MessageChannel();

      port1.onmessage = () => {
        port1.onmessage = null;
        // Close ports so this doesn't keep the event loop alive in Node.
        port1.close();
        port2.close();
        fn();
      };

      port2.postMessage(undefined);
      return;
    }
  } catch {
    // Ignore and fall back to setTimeout.
  }

  setTimeout(fn, 0);
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
}): WorkerTransport {
  let worker: WorkerLike | undefined;
  let disposed = false;

  const terminateOnDispose =
    opts.terminateOnDispose ?? (typeof opts.worker === "function" ? true : false);

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
  // Single macrotask timer for batched response settlement.
  // Invariant: if `responseSettlementMacrotask` is set, `queuedSettlementById.size > 0`.
  let responseSettlementMacrotask: ReturnType<typeof setTimeout> | undefined;
  let nextId = 1;

  const formatRequestContext = (op: string, id?: number): string =>
    id === undefined ? `(op=${op})` : `(op=${op}, id=${id})`;

  const flushQueuedSettlements = (): void => {
    responseSettlementMacrotask = undefined;

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
    if (responseSettlementMacrotask !== undefined) return;
    responseSettlementMacrotask = setTimeout(flushQueuedSettlements, 0);
  };

  const rejectAllPending = (getReason: (pending: Pending, id: number) => unknown): void => {
    // Cancel deferred settlement macrotask so it doesn't keep work queued after
    // we've already rejected the associated requests.
    if (responseSettlementMacrotask !== undefined) {
      clearTimeout(responseSettlementMacrotask);
      responseSettlementMacrotask = undefined;
    }

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
    rejectAllPending(
      (pending, id) => new Error(`${safeMessage} ${formatRequestContext(pending.op, id)}`),
    );
  };

  const onMessageError = (_ev: unknown): void => {
    rejectAllPending(
      (pending, id) =>
        new Error(`Worker message deserialization failed ${formatRequestContext(pending.op, id)}`),
    );
  };

  const ensureWorker = (): WorkerLike => {
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

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onMessageError);
    }

    return worker;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    const w = worker;

    // Best-effort: tell the worker it should dispose any server-side resources.
    //
    // - When we don't own the worker (`terminateOnDispose: false`), this is the
    //   only way to request cleanup.
    // - When we do own the worker and will terminate it, we yield a macrotask
    //   before terminating to give this message a chance to be processed.
    if (w) {
      try {
        const msg: RpcDispose = { type: tspiceRpcDisposeType };
        w.postMessage(msg);
      } catch {
        // ignore
      }
    }

    rejectAllPending((pending, id) =>
      new Error(`Worker transport disposed ${formatRequestContext(pending.op, id)}`),
    );

    if (!w) return;

    w.removeEventListener("message", onMessage);
    w.removeEventListener("error", onError);
    w.removeEventListener("messageerror", onMessageError);

    if (terminateOnDispose) {
      // We intentionally defer termination so the caller can synchronously
      // observe a disposed transport before the worker is torn down.
      //
      // Defer by 1 macrotask to give the `tspice:dispose` postMessage a chance
      // to be processed.
      queueMacrotask(() => {
        try {
          w.terminate();
        } catch {
          // ignore
        }
      });
    }

    worker = undefined;
  };

  const request = async (
    op: string,
    args: unknown[],
    requestOpts?: WorkerTransportRequestOptions,
  ): Promise<unknown> => {
    if (disposed) throw new Error(`Worker transport disposed ${formatRequestContext(op)}`);
    const id = nextId++;

    const w = ensureWorker();

    const timeoutMs = requestOpts?.timeoutMs ?? opts.timeoutMs;
    const signal = requestOpts?.signal;

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
            new Error(`Worker request timed out after ${timeoutMs}ms ${formatRequestContext(op, id)}`),
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
