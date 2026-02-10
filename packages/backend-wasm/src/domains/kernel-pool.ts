import type {
  Found,
  KernelPoolApi,
  KernelPoolVarType,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, WASM_ERR_MAX_BYTES } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import {
  readFixedWidthCStringArray,
  writeUtf8CString,
} from "../codec/strings.js";

const UTF8_ENCODER = new TextEncoder();

const POOL_STRING_MAX_BYTES = 2048;
const POOL_NAME_MAX_BYTES = 64;

function assertNonEmptyString(fn: string, field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${fn}(): ${field} must be a non-empty string`);
  }
}

function assertStringArrayNoEmptyStrings(
  fn: string,
  field: string,
  values: readonly string[],
): void {
  for (const v of values) {
    if (v.trim().length === 0) {
      throw new RangeError(`${fn}(): ${field} must not contain empty strings`);
    }
  }
}

function assertAllFinite(fn: string, field: string, values: readonly number[]): void {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new RangeError(`${fn}(): ${field} must contain only finite numbers`);
    }
  }
}

function assertAllInt32(fn: string, field: string, values: readonly number[]): void {
  for (const v of values) {
    if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
      throw new RangeError(
        `${fn}(): ${field} must contain only 32-bit integers (got ${String(v)})`,
      );
    }
  }
}


function assertPoolRange(fn: string, start: number, room: number): void {
  if (!Number.isFinite(start) || !Number.isInteger(start) || start < 0) {
    throw new RangeError(`${fn}(): start must be an integer >= 0`);
  }
  if (!Number.isFinite(room) || !Number.isInteger(room) || room <= 0) {
    throw new RangeError(`${fn}(): room must be an integer > 0`);
  }
}


function writeFixedWidthUtf8CStringArray(
  module: Pick<EmscriptenModule, "HEAPU8">,
  ptr: number,
  width: number,
  values: readonly string[],
): void {
  // Zero-initialize to ensure null termination / padding.
  //
  // Even when values is empty (n=0), we may still pass a non-null buffer to CSPICE.
  // Clear one "row" defensively.
  const count = Math.max(1, values.length);
  module.HEAPU8.fill(0, ptr, ptr + count * width);

  for (let i = 0; i < values.length; i++) {
    const encoded = UTF8_ENCODER.encode(values[i]!);
    const copyLen = Math.min(encoded.length, width - 1);
    module.HEAPU8.set(encoded.subarray(0, copyLen), ptr + i * width);
    module.HEAPU8[ptr + i * width + copyLen] = 0;
  }
}

function tspiceCallGdpool(
  module: EmscriptenModule,
  name: string,
  start: number,
  room: number,
): Found<{ values: number[] }> {
  assertPoolRange("gdpool", start, room);

  const namePtr = writeUtf8CString(module, name);

  try {
    const valuesBytes = Math.max(8, room * 8);

    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        4, // outN
        4, // found
        valuesBytes + 7, // values (+padding for 8-byte alignment)
      ],
      (errPtr, outNPtr, foundPtr, rawValuesPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;

        // Ensure 8-byte alignment for `HEAPF64` reads.
        const valuesPtr = (rawValuesPtr + 7) & ~7;

        const result = module._tspice_gdpool(
          namePtr,
          start,
          room,
          outNPtr,
          valuesPtr,
          foundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        const n = Math.max(0, module.HEAP32[outNPtr >> 2] ?? 0);
        const base = valuesPtr >> 3;
        const values = Array.from(module.HEAPF64.subarray(base, base + n));
        return { found: true, values };
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallGipool(
  module: EmscriptenModule,
  name: string,
  start: number,
  room: number,
): Found<{ values: number[] }> {
  assertPoolRange("gipool", start, room);

  const namePtr = writeUtf8CString(module, name);

  try {
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        4, // outN
        4, // found
        Math.max(4, room * 4), // values
      ],
      (errPtr, outNPtr, foundPtr, valuesPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;

        const result = module._tspice_gipool(
          namePtr,
          start,
          room,
          outNPtr,
          valuesPtr,
          foundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        const n = Math.max(0, module.HEAP32[outNPtr >> 2] ?? 0);
        const base = valuesPtr >> 2;
        const values = Array.from(module.HEAP32.subarray(base, base + n));
        return { found: true, values };
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallGcpool(
  module: EmscriptenModule,
  name: string,
  start: number,
  room: number,
): Found<{ values: string[] }> {
  assertPoolRange("gcpool", start, room);

  const namePtr = writeUtf8CString(module, name);

  try {
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        4, // outN
        4, // found
        Math.max(POOL_STRING_MAX_BYTES, room * POOL_STRING_MAX_BYTES), // values
      ],
      (errPtr, outNPtr, foundPtr, outPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;

        const result = module._tspice_gcpool(
          namePtr,
          start,
          room,
          POOL_STRING_MAX_BYTES,
          outNPtr,
          outPtr,
          foundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        const n = Math.max(0, module.HEAP32[outNPtr >> 2] ?? 0);
        const values = readFixedWidthCStringArray(
          module,
          outPtr,
          n,
          POOL_STRING_MAX_BYTES,
        );
        return { found: true, values };
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallGnpool(
  module: EmscriptenModule,
  template: string,
  start: number,
  room: number,
): Found<{ values: string[] }> {
  assertPoolRange("gnpool", start, room);

  const namePtr = writeUtf8CString(module, template);

  try {
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        4, // outN
        4, // found
        Math.max(POOL_NAME_MAX_BYTES, room * POOL_NAME_MAX_BYTES), // values
      ],
      (errPtr, outNPtr, foundPtr, outPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;

        const result = module._tspice_gnpool(
          namePtr,
          start,
          room,
          POOL_NAME_MAX_BYTES,
          outNPtr,
          outPtr,
          foundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        const n = Math.max(0, module.HEAP32[outNPtr >> 2] ?? 0);
        const values = readFixedWidthCStringArray(
          module,
          outPtr,
          n,
          POOL_NAME_MAX_BYTES,
        );
        return { found: true, values };
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallDtpool(
  module: EmscriptenModule,
  name: string,
): Found<{ n: number; type: KernelPoolVarType }> {
  const namePtr = writeUtf8CString(module, name);
  const outTypeMaxBytes = 2;

  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 4, 4, outTypeMaxBytes],
      (errPtr, foundPtr, outNPtr, outTypePtr) => {
        module.HEAP32[foundPtr >> 2] = 0;
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAPU8[outTypePtr] = 0;

        const result = module._tspice_dtpool(
          namePtr,
          foundPtr,
          outNPtr,
          outTypePtr,
          outTypeMaxBytes,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        const n = module.HEAP32[outNPtr >> 2] ?? 0;

        const t = module.UTF8ToString(outTypePtr, outTypeMaxBytes).trim();
        if (t !== "C" && t !== "N") {
          throw new Error(`dtpool(): unexpected type '${t}' for ${name}`);
        }

        return { found: true, n, type: t };
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallPdpool(module: EmscriptenModule, name: string, values: readonly number[]): void {
  assertNonEmptyString("pdpool", "name", name);
  assertAllFinite("pdpool", "values", values);

  const namePtr = writeUtf8CString(module, name);

  try {
    const n = values.length;
    const valuesBytes = Math.max(8, n * 8);

    // Ensure 8-byte alignment for `HEAPF64` writes.
    //
    // Emscripten's allocator *usually* returns suitably-aligned pointers, but we
    // don't want to rely on that here (misalignment would cause `valuesPtr >> 3`
    // to truncate and write to the wrong address).
    withAllocs(module, [WASM_ERR_MAX_BYTES, valuesBytes + 7], (errPtr, rawValuesPtr) => {
      const valuesPtr = (rawValuesPtr + 7) & ~7;

      if (n > 0) {
        module.HEAPF64.set(values, valuesPtr >> 3);
      }

      const result = module._tspice_pdpool(namePtr, n, valuesPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallPipool(module: EmscriptenModule, name: string, values: readonly number[]): void {
  assertNonEmptyString("pipool", "name", name);
  assertAllInt32("pipool", "values", values);

  const namePtr = writeUtf8CString(module, name);

  try {
    const n = values.length;
    const valuesBytes = Math.max(4, n * 4);

    // Ensure 4-byte alignment for `HEAP32` writes.
    // Mirror the `gdpool` pattern (padding + align) to be safe even if our
    // allocator doesn't guarantee alignment.
    withAllocs(module, [WASM_ERR_MAX_BYTES, valuesBytes + 3], (errPtr, rawValuesPtr) => {
      const valuesPtr = (rawValuesPtr + 3) & ~3;

      if (n > 0) {
        module.HEAP32.set(values, valuesPtr >> 2);
      }

      const result = module._tspice_pipool(namePtr, n, valuesPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallPcpool(module: EmscriptenModule, name: string, values: readonly string[]): void {
  assertNonEmptyString("pcpool", "name", name);
  // NAIF's `pcpool_c` allows `n=0` (set an empty value list). We still reject
  // blank strings.
  assertStringArrayNoEmptyStrings("pcpool", "values", values);

  const namePtr = writeUtf8CString(module, name);

  try {
    const n = values.length;
    const lenvals = POOL_STRING_MAX_BYTES;
    const totalBytes = Math.max(lenvals, n * lenvals);

    withAllocs(module, [WASM_ERR_MAX_BYTES, totalBytes], (errPtr, cvalsPtr) => {
      writeFixedWidthUtf8CStringArray(module, cvalsPtr, lenvals, values);

      const result = module._tspice_pcpool(namePtr, n, lenvals, cvalsPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallSwpool(module: EmscriptenModule, agent: string, names: readonly string[]): void {
  assertNonEmptyString("swpool", "agent", agent);
  // NAIF's `swpool_c` allows `nnames=0` (watch nothing). We still reject blank strings.
  assertStringArrayNoEmptyStrings("swpool", "names", names);

  const agentPtr = writeUtf8CString(module, agent);

  try {
    const nnames = names.length;
    const namlen = POOL_NAME_MAX_BYTES;
    const totalBytes = Math.max(namlen, nnames * namlen);

    withAllocs(module, [WASM_ERR_MAX_BYTES, totalBytes], (errPtr, namesPtr) => {
      writeFixedWidthUtf8CStringArray(module, namesPtr, namlen, names);

      const result = module._tspice_swpool(agentPtr, nnames, namlen, namesPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(agentPtr);
  }
}

function tspiceCallCvpool(module: EmscriptenModule, agent: string): boolean {
  assertNonEmptyString("cvpool", "agent", agent);

  const agentPtr = writeUtf8CString(module, agent);

  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outUpdatePtr) => {
      module.HEAP32[outUpdatePtr >> 2] = 0;
      const result = module._tspice_cvpool(agentPtr, outUpdatePtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return (module.HEAP32[outUpdatePtr >> 2] ?? 0) !== 0;
    });
  } finally {
    module._free(agentPtr);
  }
}

function tspiceCallExpool(module: EmscriptenModule, name: string): boolean {
  assertNonEmptyString("expool", "name", name);

  const namePtr = writeUtf8CString(module, name);

  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outFoundPtr) => {
      module.HEAP32[outFoundPtr >> 2] = 0;
      const result = module._tspice_expool(namePtr, outFoundPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
    });
  } finally {
    module._free(namePtr);
  }
}

export function createKernelPoolApi(module: EmscriptenModule): KernelPoolApi {
  return {
    gdpool: (name, start, room) => tspiceCallGdpool(module, name, start, room),
    gipool: (name, start, room) => tspiceCallGipool(module, name, start, room),
    gcpool: (name, start, room) => tspiceCallGcpool(module, name, start, room),
    gnpool: (template, start, room) => tspiceCallGnpool(module, template, start, room),
    dtpool: (name) => tspiceCallDtpool(module, name),

    pdpool: (name, values) => tspiceCallPdpool(module, name, values),
    pipool: (name, values) => tspiceCallPipool(module, name, values),
    pcpool: (name, values) => tspiceCallPcpool(module, name, values),

    swpool: (agent, names) => tspiceCallSwpool(module, agent, names),
    cvpool: (agent) => tspiceCallCvpool(module, agent),
    expool: (name) => tspiceCallExpool(module, name),
  } satisfies KernelPoolApi;
}
