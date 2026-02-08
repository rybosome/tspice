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

export function createWorkerTransport(opts: {
  worker: Worker | (() => Worker);
}): SpiceTransport {
  let worker: Worker | undefined;

  type Pending = {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  };

  const pendingById = new Map<number, Pending>();
  let nextId = 1;

  const ensureWorker = (): Worker => {
    if (!worker) {
      worker = typeof opts.worker === "function" ? opts.worker() : opts.worker;

      worker.addEventListener("message", (ev: MessageEvent<unknown>) => {
        const msg = ev.data as Partial<RpcResponse> | null | undefined;
        if (!msg || msg.type !== "tspice:response" || typeof msg.id !== "number") return;

        const pending = pendingById.get(msg.id);
        if (!pending) return;
        pendingById.delete(msg.id);

        if (msg.ok === true) {
          pending.resolve((msg as Extract<RpcResponse, { ok: true }>).value);
          return;
        }

        const err = deserializeError((msg as Extract<RpcResponse, { ok: false }>).error);
        pending.reject(err);
      });

      // If the worker itself errors, fail all in-flight requests.
      worker.addEventListener("error", (ev: ErrorEvent) => {
        const err = new Error(ev.message || "Worker error");
        for (const { reject } of pendingById.values()) reject(err);
        pendingById.clear();
      });

      worker.addEventListener("messageerror", () => {
        const err = new Error("Worker message deserialization failed");
        for (const { reject } of pendingById.values()) reject(err);
        pendingById.clear();
      });
    }

    return worker;
  };

  return {
    async request(op, args) {
      const id = nextId++;
      const w = ensureWorker();

      return await new Promise<unknown>((resolve, reject) => {
        pendingById.set(id, { resolve, reject });

        const msg: RpcRequest = { type: "tspice:request", id, op, args };
        try {
          w.postMessage(msg);
        } catch (err) {
          pendingById.delete(id);
          reject(err);
        }
      });
    },
  };
}
