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
  const defaultMessage = "Worker request failed";

  const readStringProp = (
    obj: unknown,
    key: string,
  ): string | undefined => {
    if (!obj || typeof obj !== "object") return undefined;
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  };

  if (err instanceof Error) {
    const out: SerializedError = { message: err.message || defaultMessage };
    if (typeof err.name === "string" && err.name) out.name = err.name;
    if (typeof err.stack === "string") out.stack = err.stack;
    return out;
  }

  if (typeof err === "string") {
    return { message: err };
  }

  if (err && typeof err === "object") {
    const message = readStringProp(err, "message") ?? defaultMessage;
    const name = readStringProp(err, "name");
    const stack = readStringProp(err, "stack");

    const out: SerializedError = { message };
    if (typeof name === "string" && name) out.name = name;
    if (typeof stack === "string") out.stack = stack;
    return out;
  }

  // Only stringify primitives (avoid calling an arbitrary `.toString()` on objects).
  if (
    typeof err === "number" ||
    typeof err === "boolean" ||
    typeof err === "bigint"
  ) {
    return { message: String(err) };
  }

  return { message: defaultMessage };
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
