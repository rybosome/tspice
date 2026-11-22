import type { EmscriptenModule } from "../lowlevel/exports.js";
import { mallocOrThrow, WASM_ERR_MAX_BYTES } from "./alloc.js";
import { throwWasmSpiceError } from "./errors.js";

type MaybePromise<T> = T | Promise<T>;
type Frame = {
  invoke: (slot: number, args: readonly unknown[]) => MaybePromise<number>;
  asynchronous: boolean;
  failure?: { error: unknown };
};
type Runtime = {
  frames: Map<number, Frame>;
  sequence: number;
  suspended: boolean;
};
const runtimes = new WeakMap<EmscriptenModule, Runtime>();

function runtimeFor(module: EmscriptenModule) {
  const existing = runtimes.get(module);
  if (existing) return existing;
  const runtime: Runtime = { frames: new Map(), sequence: 0, suspended: false };
  module.tspiceInvokeGf = (id, slot, ...args) => {
    const frame = runtime.frames.get(id);
    if (!frame || frame.failure) return NaN;
    const failed = (error: unknown) => {
      frame.failure = { error };
      return NaN;
    };
    try {
      const value = frame.invoke(slot, args);
      if (value instanceof Promise) {
        if (!frame.asynchronous) {
          void value.catch(() => undefined);
          throw new TypeError(
            "A synchronous GF callback must return synchronously",
          );
        }
        return value.catch(failed);
      }
      return value;
    } catch (error) {
      return failed(error);
    }
  };
  runtimes.set(module, runtime);
  return runtime;
}

export type WasmGfInvocation<T> = {
  /** Export name without the leading underscore. */
  symbol: string;
  invoke: Frame["invoke"];
  /** Allocate only through allocate(). All buffers survive until the final callback resumes. */
  prepare: (
    id: number,
    allocate: (size: number) => number,
  ) => { args: number[]; read: () => T };
  direct: (...args: number[]) => number;
};
export function runWasmGf<T>(
  module: EmscriptenModule,
  asynchronous: false,
  request: WasmGfInvocation<T>,
): T;
export function runWasmGf<T>(
  module: EmscriptenModule,
  asynchronous: true,
  request: WasmGfInvocation<T>,
): Promise<T>;
export function runWasmGf<T>(
  module: EmscriptenModule,
  asynchronous: boolean,
  request: WasmGfInvocation<T>,
): MaybePromise<T>;
/** Retain the callback frame and its allocated buffers until the scientific call returns or resumes. */
export function runWasmGf<T>(
  module: EmscriptenModule,
  asynchronous: boolean,
  request: WasmGfInvocation<T>,
): MaybePromise<T> {
  const runtime = runtimeFor(module);
  if (runtime.suspended)
    throw new Error(
      "A GF callback operation is already suspended in this WASM instance",
    );
  const id = ++runtime.sequence;
  if (runtime.sequence === 0x7fffffff) runtime.sequence = 0;
  const frame: Frame = { invoke: request.invoke, asynchronous };
  runtime.frames.set(id, frame);
  const allocations: number[] = [];
  const allocate = (size: number) => {
    const ptr = mallocOrThrow(module, size);
    allocations.push(ptr);
    return ptr;
  };
  const release = () => {
    runtime.frames.delete(id);
    while (allocations.length) module._free(allocations.pop()!);
  };
  try {
    const err = allocate(WASM_ERR_MAX_BYTES);
    const invocation = request.prepare(id, allocate);
    const args = [...invocation.args, err, WASM_ERR_MAX_BYTES];
    const finish = (status: number) => {
      if (frame.failure) throw frame.failure.error;
      if (status) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
      return invocation.read();
    };
    if (asynchronous) {
      const result = module.ccall(
        request.symbol,
        "number",
        args.map(() => "number"),
        args,
        { async: true },
      );
      runtime.suspended = true;
      return Promise.resolve(result)
        .then(finish)
        .finally(() => {
          runtime.suspended = false;
          release();
        });
    }
    const value = finish(request.direct(...args));
    release();
    return value;
  } catch (error) {
    release();
    throw error;
  }
}
