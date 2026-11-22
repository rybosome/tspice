import type {
  GfControl,
  GfEventSearch,
  GfFovSearch,
  GfOccultationSearch,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  bindConfiguredGfControl,
  fovRayDirection,
  spiceStringByteLength,
} from "@rybosome/tspice-core";
import { runWasmGf, type WasmGfInvocation } from "../codec/gf-callbacks.js";
import type { EmscriptenModule } from "../lowlevel/exports.js";
import { wasmWindowPointer } from "./cells-windows.js";

type Allocate = (bytes: number) => number;
type Direct = WasmGfInvocation<void>["direct"];
type Search = GfEventSearch | GfFovSearch | GfOccultationSearch;
const encoder = new TextEncoder();

function bytes(value: string) {
  spiceStringByteLength(value, "Geometry Finder text input");
  return encoder.encode(value);
}

function optionalFlag(value: boolean | undefined, label: string): number {
  if (value === undefined) return 0;
  if (typeof value !== "boolean")
    throw new TypeError(`Expected a boolean GF ${label}`);
  return Number(value);
}

/** Bind configurable searches to the worker-compatible WASM callback runtime. */
export function createConfiguredGf(module: EmscriptenModule) {
  function writeText(value: string, allocate: Allocate) {
    const data = bytes(value);
    const ptr = allocate(data.length + 1);
    module.HEAPU8.set(data, ptr >>> 0);
    module.HEAPU8[(ptr >>> 0) + data.length] = 0;
    return ptr;
  }

  function encodeEvent(search: GfEventSearch, allocate: Allocate) {
    if (!Array.isArray(search.parameters) || search.parameters.length > 128)
      throw new RangeError("Invalid Geometry Finder parameter table");
    assertSpiceInt32(search.workspaceIntervals, "GF workspace intervals");
    const count = search.parameters.length;
    const names = search.parameters.map((row) => bytes(row.name));
    const texts = search.parameters.map((row) =>
      bytes(row.text === undefined ? "" : row.text),
    );
    const rowBytes = Math.max(
      2,
      ...names.map((v) => v.length + 1),
      ...texts.map((v) => v.length + 1),
    );
    if (rowBytes > 8192)
      throw new RangeError("Geometry Finder parameter row is too long");
    const writeColumn = (data: Uint8Array[]) => {
      const length = rowBytes * Math.max(1, count);
      const ptr = allocate(length);
      module.HEAPU8.fill(0, ptr >>> 0, (ptr >>> 0) + length);
      data.forEach((row, index) =>
        module.HEAPU8.set(row, (ptr >>> 0) + index * rowBytes),
      );
      return ptr;
    };
    const namePtr = writeColumn(names);
    const textPtr = writeColumn(texts);
    const reals = allocate(8 * Math.max(1, count));
    const integers = allocate(4 * Math.max(1, count));
    const logicals = allocate(4 * Math.max(1, count));
    search.parameters.forEach((row, index) => {
      const real = row.real === undefined ? 0 : row.real;
      if (typeof real !== "number" || !Number.isFinite(real))
        throw new RangeError("Expected a finite GF quantity parameter");
      const integer = row.integer === undefined ? 0 : row.integer;
      assertSpiceInt32(integer, "GF quantity integer parameter");
      module.HEAPF64[(reals >>> 3) + index] = real;
      module.HEAP32[(integers >>> 2) + index] = integer;
      module.HEAP32[(logicals >>> 2) + index] = optionalFlag(
        row.logical,
        "quantity logical parameter",
      );
    });
    return [
      writeText(search.quantity, allocate),
      count,
      rowBytes,
      namePtr,
      textPtr,
      reals,
      integers,
      logicals,
      writeText(search.relation, allocate),
      search.reference,
      search.tolerance,
      search.adjustment,
      search.workspaceIntervals,
    ];
  }
  function encodeFov(search: GfFovSearch, allocate: Allocate) {
    const ray = fovRayDirection(search.ray);
    const vector = allocate(24);
    module.HEAPF64.set(ray, vector >>> 3);
    return [
      writeText(search.instrument, allocate),
      writeText(search.shape, allocate),
      vector,
      ...[search.target, search.frame, search.aberration, search.observer].map(
        (text) => writeText(text, allocate),
      ),
      search.tolerance,
    ];
  }
  function encodeOccultation(search: GfOccultationSearch, allocate: Allocate) {
    return [
      ...[
        search.occultation,
        search.front,
        search.frontShape,
        search.frontFrame,
        search.back,
        search.backShape,
        search.backFrame,
        search.aberration,
        search.observer,
      ].map((text) => writeText(text, allocate)),
      search.tolerance,
    ];
  }

  function invoke<T extends Search>(
    asynchronous: boolean,
    symbol: string,
    direct: Direct,
    marshal: (search: T, allocate: Allocate) => number[],
    search: T,
    cnfine: SpiceWindow,
    result: SpiceWindow,
    control: GfControl,
  ) {
    if (typeof search !== "object" || search === null)
      throw new TypeError("Expected a Geometry Finder search specification");
    if (
      typeof search.tolerance !== "number" ||
      !Number.isFinite(search.tolerance) ||
      search.tolerance <= 0
    )
      throw new RangeError("Expected a positive GF convergence tolerance");
    const report = optionalFlag(search.report, "report flag");
    const bail = optionalFlag(search.bail, "bail flag");
    const input = wasmWindowPointer(module, cnfine, `${symbol} confinement`);
    const output = wasmWindowPointer(module, result, `${symbol} result`);
    const callback = bindConfiguredGfControl(control, asynchronous);
    return runWasmGf(module, asynchronous, {
      symbol,
      direct,
      invoke: callback,
      prepare(id, allocate) {
        return {
          args: [
            0,
            id,
            ...marshal(search, allocate),
            report,
            bail,
            input,
            output,
          ],
          read: () => undefined,
        };
      },
    });
  }

  type Args<T extends Search> = [
    search: T,
    cnfine: SpiceWindow,
    result: SpiceWindow,
    control: GfControl,
  ];
  return {
    gfevnt: (async: boolean, direct: Direct, ...args: Args<GfEventSearch>) =>
      invoke(async, "tspice_gfevnt", direct, encodeEvent, ...args),
    gffove: (async: boolean, direct: Direct, ...args: Args<GfFovSearch>) =>
      invoke(async, "tspice_gffove", direct, encodeFov, ...args),
    gfocce: (
      async: boolean,
      direct: Direct,
      ...args: Args<GfOccultationSearch>
    ) => invoke(async, "tspice_gfocce", direct, encodeOccultation, ...args),
  };
}
