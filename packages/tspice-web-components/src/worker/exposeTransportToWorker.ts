import type { SpiceTransport } from "../types.js";

import type { RpcMessageFromMain, RpcRequest, RpcResponse } from "./rpcProtocol.js";
import {
  serializeError,
  tspiceRpcDisposeType,
  tspiceRpcRequestType,
  tspiceRpcResponseType,
} from "./rpcProtocol.js";
import { decodeRpcValue, encodeRpcValue } from "./rpcValueCodec.js";

type WorkerGlobalScopeLike = {
  addEventListener(type: "message", listener: (ev: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (ev: MessageEvent<unknown>) => void): void;
  postMessage(msg: unknown): void;
  close?: () => void;
};

export function exposeTransportToWorker(opts: {
  transport: SpiceTransport;
  /**
   * Override the Worker global scope for testing.
   *
   * Defaults to `globalThis`.
   */
  self?: WorkerGlobalScopeLike;
  /** Optional cleanup hook called when a dispose message is received. */
  onDispose?: () => void | Promise<void>;
  /** Whether to call `self.close()` after disposing. Defaults to `true`. */
  closeOnDispose?: boolean;
}): { dispose: () => void } {
  const self = opts.self ?? (globalThis as unknown as WorkerGlobalScopeLike);

  let disposed = false;

  const onMessage = (ev: MessageEvent<unknown>): void => {
    const msg = ev.data as Partial<RpcMessageFromMain> | null | undefined;
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === tspiceRpcDisposeType) {
      // Dispose is a one-way signal; ignore any further traffic.
      if (disposed) return;
      disposed = true;

      void (async () => {
        try {
          await opts.onDispose?.();
        } finally {
          self.removeEventListener("message", onMessage);

          const closeOnDispose = opts.closeOnDispose ?? true;
          if (closeOnDispose) {
            try {
              self.close?.();
            } catch {
              // ignore
            }
          }
        }
      })();

      return;
    }

    // Ignore any further traffic after disposal (including in-flight requests
    // that may finish later).
    if (disposed) return;

    if (msg.type === tspiceRpcRequestType) {
      const req = msg as Partial<RpcRequest>;

      const id = req.id;
      const op = req.op;
      const args = req.args;

      if (typeof id !== "number" || typeof op !== "string" || !Array.isArray(args)) {
        return;
      }

      void (async () => {
        try {
          const value = await opts.transport.request(op, args.map(decodeRpcValue));
          if (disposed) return;

          const res: RpcResponse = {
            type: tspiceRpcResponseType,
            id,
            ok: true,
            value: encodeRpcValue(value),
          };
          self.postMessage(res);
        } catch (err) {
          if (disposed) return;

          const res: RpcResponse = {
            type: tspiceRpcResponseType,
            id,
            ok: false,
            error: serializeError(err),
          };
          self.postMessage(res);
        }
      })();

      return;
    }
  };

  self.addEventListener("message", onMessage);

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    // Note: this does not cancel any in-flight `transport.request()` calls; it
    // just prevents any further responses from being posted.
    self.removeEventListener("message", onMessage);
  };

  return { dispose };
}
