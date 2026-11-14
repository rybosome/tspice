import {
  deserializeError,
  serializeError,
} from "../../transport/rpc/protocol.js";

export const gfCallbackCall = "tspice.gf.callback";
export const gfCallbackCancel = "tspice.gf.callback.cancel";
const gfCallbackReply = "tspice.gf.callback.result";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function positions(op: string): readonly number[] {
  switch (op) {
    case "raw.uddf":
    case "raw.uddc":
      return [0];
    case "raw.gfudb":
    case "raw.gfuds":
      return [0, 1];
    default:
      return [];
  }
}
/** Identify RPC operations that accept callable arguments. */
export function usesGfCallbacks(op: string) {
  return positions(op).length > 0;
}
/** Replace an expected function argument with its request-local slot for structured cloning. */
export function encodeGfCallback(op: string, index: number, value: unknown) {
  if (positions(op).includes(index) && typeof value === "function")
    return { gfCallback: index };
  return value;
}

/** Evaluate a worker callback on the originating client and reply to its specific pending invocation. */
export function dispatchGfCallback(
  data: unknown,
  lookup: (id: number) => { op: string; args: unknown[] } | undefined,
  send: (value: unknown) => void,
): boolean {
  if (!record(data) || data.type !== gfCallbackCall) return false;
  const { id, slot, call, args } = data;
  if (
    typeof id !== "number" ||
    typeof slot !== "number" ||
    typeof call !== "number" ||
    !Array.isArray(args)
  )
    return true;
  const request = lookup(id);
  void (async () => {
    try {
      if (!request || !positions(request.op).includes(slot))
        throw new Error("GF callback request is no longer active");
      const fn: unknown = request.args[slot];
      if (typeof fn !== "function") throw new TypeError("Invalid GF callback");
      const parameters =
        slot === 1 && (request.op === "raw.gfuds" || request.op === "raw.gfudb")
          ? [request.args[0], ...args]
          : args;
      const result: unknown = await Reflect.apply(fn, undefined, parameters);
      if (
        result !== undefined &&
        typeof result !== "number" &&
        typeof result !== "boolean"
      )
        throw new TypeError("Invalid GF callback result");
      send({ type: gfCallbackReply, id, call, ok: true, value: result });
    } catch (error) {
      send({
        type: gfCallbackReply,
        id,
        call,
        ok: false,
        error: serializeError(error),
      });
    }
  })().catch(() => undefined);
  return true;
}

/** Each in-flight numerical call retains its callback closures until completion, error or disposal. */
export function createWorkerGfCallbacks(send: (value: unknown) => void) {
  const pending = new Map<
    number,
    {
      id: number;
      resolve: (value: unknown) => void;
      reject: (error: unknown) => void;
    }
  >();
  const cancelled = new Set<number>();
  let sequence = 0,
    disposed = false;
  return {
    decode(op: string, id: number, slot: number, wire: unknown): unknown {
      if (
        !positions(op).includes(slot) ||
        !record(wire) ||
        wire.gfCallback !== slot
      )
        return wire;
      return (...args: unknown[]) =>
        new Promise<unknown>((resolve, reject) => {
          if (disposed || cancelled.has(id)) {
            reject(new Error("GF callback request ended"));
            return;
          }
          // The client already owns the first-class scalar function passed to a GF predicate.
          const parameters =
            slot === 1 && (op === "raw.gfuds" || op === "raw.gfudb")
              ? args.slice(1)
              : args;
          const call = ++sequence;
          pending.set(call, { id, resolve, reject });
          try {
            send({ type: gfCallbackCall, id, slot, call, args: parameters });
          } catch (error) {
            pending.delete(call);
            reject(error);
          }
        });
    },
    complete(id: number) {
      cancelled.delete(id);
    },
    receive(packet: unknown): boolean {
      if (
        record(packet) &&
        packet.type === gfCallbackCancel &&
        typeof packet.id === "number"
      ) {
        const id = packet.id;
        // Only a pending call can still hold a suspended native stack.
        for (const [call, entry] of pending) {
          if (entry.id === id) {
            cancelled.add(id);
            pending.delete(call);
            entry.reject(new Error("GF callback cancelled"));
          }
        }
        return true;
      }
      if (!record(packet) || packet.type !== gfCallbackReply) return false;
      const { id, call } = packet;
      if (typeof call !== "number") return true;
      const saved = pending.get(call);
      if (!saved || saved.id !== id) return true;
      pending.delete(call);
      if (packet.ok === true) saved.resolve(packet.value);
      else if (record(packet.error) && typeof packet.error.message === "string")
        saved.reject(
          deserializeError({
            message: packet.error.message,
            ...(typeof packet.error.name === "string"
              ? { name: packet.error.name }
              : {}),
          }),
        );
      else saved.reject(new Error("Invalid GF callback reply"));
      return true;
    },
    dispose() {
      disposed = true;
      for (const entry of pending.values())
        entry.reject(new Error("Worker disposed"));
      pending.clear();
      cancelled.clear();
    },
  };
}
