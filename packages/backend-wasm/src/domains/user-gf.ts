import { runWasmGf, type WasmGfInvocation } from "../codec/gf-callbacks.js";
import type {
  GeometryGfApi,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32, spiceStringByteLength } from "@rybosome/tspice-core";
import type { EmscriptenModule } from "../lowlevel/exports.js";
import { wasmWindowPointer } from "./cells-windows.js";

type CallbackMethod = "uddf" | "uddc" | "gfudb" | "gfuds";
type Scalar = Parameters<GeometryGfApi["uddf"]>[0];
type Condition = Parameters<GeometryGfApi["gfudb"]>[1];
function validateResult(value: unknown, predicate: boolean): number {
  if (predicate && typeof value === "boolean") return Number(value);
  if (!predicate && typeof value === "number" && Number.isFinite(value))
    return value;
  throw new TypeError(
    predicate
      ? "GF predicate must return a boolean"
      : "GF scalar must return a finite number",
  );
}

/** Bind the synchronous and suspending user-function calls to one toolkit instance. */
export function createUserGf(module: EmscriptenModule) {
  function request(
    method: CallbackMethod,
    direct: WasmGfInvocation<void>["direct"],
    scalar: Scalar,
    condition: Condition | undefined,
    marshall: (allocate: (size: number) => number, out: number) => number[],
    output: "number" | "boolean" | "void",
  ): WasmGfInvocation<number | boolean | void> {
    if (
      typeof scalar !== "function" ||
      (method.startsWith("gf") && typeof condition !== "function")
    )
      throw new TypeError("GF callbacks must be functions");
    return {
      symbol: "tspice_" + method,
      direct,
      invoke(slot, args) {
        const time = args[0];
        if (typeof time !== "number")
          throw new TypeError("Invalid GF callback epoch");
        let result: unknown;
        if (slot === 1 && condition) result = condition(scalar, time);
        else if (slot === 0) result = scalar(time);
        else throw new TypeError("Invalid GF callback slot");
        if (result instanceof Promise)
          return result.then((v) => validateResult(v, slot === 1));
        return validateResult(result, slot === 1);
      },
      prepare(id, allocate) {
        const out = output === "void" ? 0 : allocate(8);
        return {
          args: [0, id, ...marshall(allocate, out)],
          read: () => {
            if (output === "number") return module.HEAPF64[out >>> 3]!;
            if (output === "boolean") return module.HEAP32[out >>> 2] !== 0;
          },
        };
      },
    };
  }
  function run(asynchronous: boolean, ...args: Parameters<typeof request>) {
    return runWasmGf(module, asynchronous, request(...args));
  }
  const derivative = (
    async: boolean,
    direct: WasmGfInvocation<void>["direct"],
    method: "uddf" | "uddc",
    f: Scalar,
    x: number,
    dx: number,
  ) =>
    run(
      async,
      method,
      direct,
      f,
      undefined,
      (_alloc, out) => {
        if (typeof x !== "number" || typeof dx !== "number")
          throw new TypeError("GF samples must be numbers");
        return [x, dx, out];
      },
      method === "uddf" ? "number" : "boolean",
    );
  const booleanSearch = (
    async: boolean,
    direct: WasmGfInvocation<void>["direct"],
    f: Scalar,
    p: Condition,
    step: number,
    c: SpiceWindow,
    r: SpiceWindow,
  ) =>
    run(
      async,
      "gfudb",
      direct,
      f,
      p,
      () => {
        if (typeof step !== "number")
          throw new TypeError("GF step must be numeric");
        return [
          step,
          wasmWindowPointer(module, c, "gfudb(cnfine)"),
          wasmWindowPointer(module, r, "gfudb(result)"),
        ];
      },
      "void",
    );
  const scalarSearch = (
    async: boolean,
    direct: WasmGfInvocation<void>["direct"],
    f: Scalar,
    p: Condition,
    relate: string,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    c: SpiceWindow,
    r: SpiceWindow,
  ) =>
    run(
      async,
      "gfuds",
      direct,
      f,
      p,
      (allocate) => {
        if ([refval, adjust, step].some((value) => typeof value !== "number"))
          throw new TypeError("Expected numeric scalar search bounds");
        assertSpiceInt32(nintvls, "nintvls");
        const size = spiceStringByteLength(relate, "relate") + 1,
          ptr = allocate(size);
        new TextEncoder().encodeInto(
          relate,
          module.HEAPU8.subarray(ptr, ptr + size - 1),
        );
        module.HEAPU8[ptr + size - 1] = 0;
        return [
          ptr,
          refval,
          adjust,
          step,
          nintvls,
          wasmWindowPointer(module, c, "gfuds(cnfine)"),
          wasmWindowPointer(module, r, "gfuds(result)"),
        ];
      },
      "void",
    );

  const sync = {
    uddf(
      direct: EmscriptenModule["_tspice_uddf"],
      ...args: Parameters<GeometryGfApi["uddf"]>
    ) {
      const result = derivative(false, direct, "uddf", ...args);
      if (typeof result !== "number") throw new Error("Missing derivative");
      return result;
    },
    uddc(
      direct: EmscriptenModule["_tspice_uddc"],
      ...args: Parameters<GeometryGfApi["uddc"]>
    ) {
      const result = derivative(false, direct, "uddc", ...args);
      if (typeof result !== "boolean")
        throw new Error("Missing derivative sign");
      return result;
    },
    gfudb(
      direct: EmscriptenModule["_tspice_gfudb"],
      ...args: Parameters<GeometryGfApi["gfudb"]>
    ) {
      booleanSearch(false, direct, ...args);
    },
    gfuds(
      direct: EmscriptenModule["_tspice_gfuds"],
      ...args: Parameters<GeometryGfApi["gfuds"]>
    ) {
      scalarSearch(false, direct, ...args);
    },
  };
  const asynchronous: {
    [K in CallbackMethod]: (
      ...args: Parameters<GeometryGfApi[K]>
    ) => Promise<ReturnType<GeometryGfApi[K]>>;
  } = {
    uddf: async (f, x, dx) => {
      const v = await derivative(true, module._tspice_uddf, "uddf", f, x, dx);
      if (typeof v !== "number") throw new Error("Missing derivative");
      return v;
    },
    uddc: async (f, x, dx) => {
      const v = await derivative(true, module._tspice_uddc, "uddc", f, x, dx);
      if (typeof v !== "boolean") throw new Error("Missing derivative sign");
      return v;
    },
    gfudb: async (...args) => {
      await booleanSearch(true, module._tspice_gfudb, ...args);
    },
    gfuds: async (...args) => {
      await scalarSearch(true, module._tspice_gfuds, ...args);
    },
  };
  return { sync, asynchronous };
}
