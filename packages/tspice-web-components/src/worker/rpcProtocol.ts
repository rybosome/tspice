export const tspiceRpcRequestType = "tspice:request" as const;
export const tspiceRpcResponseType = "tspice:response" as const;
export const tspiceRpcDisposeType = "tspice:dispose" as const;

export type RpcRequest = {
  type: typeof tspiceRpcRequestType;
  id: number;
  op: string;
  args: unknown[];
};

export type RpcDispose = {
  type: typeof tspiceRpcDisposeType;
};

export type SerializedError = {
  message: string;
  name?: string;
  stack?: string;
};

export type RpcResponse =
  | {
      type: typeof tspiceRpcResponseType;
      id: number;
      ok: true;
      value: unknown;
    }
  | {
      type: typeof tspiceRpcResponseType;
      id: number;
      ok: false;
      error: SerializedError;
    };

export type RpcMessageFromMain = RpcRequest | RpcDispose;
export type RpcMessageFromWorker = RpcResponse;

export function serializeError(err: unknown): SerializedError {
  if (err && typeof err === "object") {
    const anyErr = err as any;

    // Native Errors (including DOMException) typically have `message` and
    // `name`, and may have `stack`.
    const message =
      typeof anyErr.message === "string"
        ? anyErr.message
        : typeof anyErr.toString === "function"
          ? String(anyErr)
          : "Worker request failed";

    const out: SerializedError = { message };
    if (typeof anyErr.name === "string") out.name = anyErr.name;
    if (typeof anyErr.stack === "string") out.stack = anyErr.stack;
    return out;
  }

  return {
    message: typeof err === "string" ? err : "Worker request failed",
  };
}

export function deserializeError(err: unknown): Error {
  if (err && typeof err === "object") {
    const e = err as Partial<SerializedError>;
    const out = new Error(
      typeof e.message === "string" ? e.message : "Worker request failed",
    );
    if (typeof e.name === "string") out.name = e.name;
    if (typeof e.stack === "string") out.stack = e.stack;
    return out;
  }

  return new Error(typeof err === "string" ? err : "Worker request failed");
}
