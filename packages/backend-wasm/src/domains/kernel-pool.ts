import { resolveKernelPath } from "../runtime/fs.js";
import type {
  Found,
  KernelPoolApi,
  KernelPoolVarType,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
  poolLineTable,
  poolTypeChar,
  poolSourceBytes,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import {
  withAllocs,
  WASM_ERR_MAX_BYTES,
  WASM_MAX_ALLOC_BYTES,
} from "../codec/alloc.js";
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
  if (!Array.isArray(values))
    throw new TypeError(`${fn}(): ${field} must be an array`);
  for (const v of values) {
    if (v.trim().length === 0) {
      throw new RangeError(`${fn}(): ${field} must not contain empty strings`);
    }
  }
}

function assertAllFinite(
  fn: string,
  field: string,
  values: readonly number[],
): void {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new RangeError(
        `${fn}(): ${field} must contain only finite numbers`,
      );
    }
  }
}

function assertAllInt32(
  fn: string,
  field: string,
  values: readonly number[],
): void {
  for (const v of values) {
    if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
      throw new RangeError(
        `${fn}(): ${field} must contain only 32-bit integers (got ${String(v)})`,
      );
    }
  }
}

function assertPoolRange(fn: string, start: number, room: number): void {
  assertSpiceInt32NonNegative(start, `${fn}(start)`);
  assertSpiceInt32NonNegative(room, `${fn}(room)`);
  if (room === 0) throw new RangeError(`${fn}(room): expected an integer > 0`);
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
  assertNonEmptyString("gdpool", "name", name);
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
  assertNonEmptyString("gipool", "name", name);
  assertPoolRange("gipool", start, room);

  const namePtr = writeUtf8CString(module, name);

  try {
    const valuesBytes = Math.max(4, room * 4);

    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        4, // outN
        4, // found
        valuesBytes + 3, // values (+padding for 4-byte alignment)
      ],
      (errPtr, outNPtr, foundPtr, rawValuesPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;

        // Ensure 4-byte alignment for `HEAP32` reads.
        const valuesPtr = (rawValuesPtr + 3) & ~3;

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
  assertNonEmptyString("gcpool", "name", name);
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
  assertNonEmptyString("gnpool", "template", template);
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
  assertNonEmptyString("dtpool", "name", name);

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

function tspiceCallPdpool(
  module: EmscriptenModule,
  name: string,
  values: readonly number[],
): void {
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
    withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, valuesBytes + 7],
      (errPtr, rawValuesPtr) => {
        const valuesPtr = (rawValuesPtr + 7) & ~7;

        if (n > 0) {
          module.HEAPF64.set(values, valuesPtr >> 3);
        }

        const result = module._tspice_pdpool(
          namePtr,
          n,
          valuesPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallPipool(
  module: EmscriptenModule,
  name: string,
  values: readonly number[],
): void {
  assertNonEmptyString("pipool", "name", name);
  assertAllInt32("pipool", "values", values);

  const namePtr = writeUtf8CString(module, name);

  try {
    const n = values.length;
    const valuesBytes = Math.max(4, n * 4);

    // Ensure 4-byte alignment for `HEAP32` writes.
    // Mirror the `gdpool` pattern (padding + align) to be safe even if our
    // allocator doesn't guarantee alignment.
    withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, valuesBytes + 3],
      (errPtr, rawValuesPtr) => {
        const valuesPtr = (rawValuesPtr + 3) & ~3;

        if (n > 0) {
          module.HEAP32.set(values, valuesPtr >> 2);
        }

        const result = module._tspice_pipool(
          namePtr,
          n,
          valuesPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
      },
    );
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallPcpool(
  module: EmscriptenModule,
  name: string,
  values: readonly string[],
): void {
  assertNonEmptyString("pcpool", "name", name);
  if (!Array.isArray(values))
    throw new TypeError("pcpool(): values must be an array");
  for (const value of values) {
    if (typeof value !== "string")
      throw new TypeError("pcpool(): values must contain only strings");
  }

  const namePtr = writeUtf8CString(module, name);

  try {
    const n = values.length;
    const lenvals = POOL_STRING_MAX_BYTES;
    const totalBytes = Math.max(lenvals, n * lenvals);

    withAllocs(module, [WASM_ERR_MAX_BYTES, totalBytes], (errPtr, cvalsPtr) => {
      writeFixedWidthUtf8CStringArray(module, cvalsPtr, lenvals, values);

      const result = module._tspice_pcpool(
        namePtr,
        n,
        lenvals,
        cvalsPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallSwpool(
  module: EmscriptenModule,
  agent: string,
  names: readonly string[],
): void {
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

      const result = module._tspice_swpool(
        agentPtr,
        nnames,
        namlen,
        namesPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
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
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 4],
      (errPtr, outUpdatePtr) => {
        module.HEAP32[outUpdatePtr >> 2] = 0;
        const result = module._tspice_cvpool(
          agentPtr,
          outUpdatePtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
        return (module.HEAP32[outUpdatePtr >> 2] ?? 0) !== 0;
      },
    );
  } finally {
    module._free(agentPtr);
  }
}

function tspiceCallExpool(module: EmscriptenModule, name: string): boolean {
  assertNonEmptyString("expool", "name", name);

  const namePtr = writeUtf8CString(module, name);

  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 4],
      (errPtr, outFoundPtr) => {
        module.HEAP32[outFoundPtr >> 2] = 0;
        const result = module._tspice_expool(
          namePtr,
          outFoundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
        return (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
      },
    );
  } finally {
    module._free(namePtr);
  }
}

const strictPoolDecoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});

function encodedPoolText(value: string, label: string): Uint8Array {
  spiceStringByteLength(value, label, WASM_MAX_ALLOC_BYTES - 1);
  return UTF8_ENCODER.encode(value);
}

function putPoolText(
  module: EmscriptenModule,
  ptr: number,
  bytes: Uint8Array,
): void {
  module.HEAPU8.set(bytes, ptr);
  module.HEAPU8[ptr + bytes.length] = 0;
}

function checkPoolStatus(
  module: EmscriptenModule,
  rc: number,
  err: number,
): void {
  if (rc) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, rc);
}

function bodyResult(
  module: EmscriptenModule,
  maxn: number,
  dimPtr: number,
  valuesPtr: number,
) {
  const dim = module.HEAP32[dimPtr / 4];
  if (dim === undefined || dim < 0 || dim > Math.min(maxn, 400000))
    throw new Error("Invalid body constant output dimension");
  const base = valuesPtr / 8;
  return { dim, values: Array.from(module.HEAPF64.subarray(base, base + dim)) };
}

function poolLoadPath(module: EmscriptenModule, path: string): void {
  const bytes = encodedPoolText(path, "ldpool path");
  withAllocs(module, [WASM_ERR_MAX_BYTES, bytes.length + 1], (err, file) => {
    putPoolText(module, file, bytes);
    checkPoolStatus(
      module,
      module._tspice_ldpool(file, err, WASM_ERR_MAX_BYTES),
      err,
    );
  });
}

/** Create a {@link KernelPoolApi} implementation backed by a WASM Emscripten module. */
export function createKernelPoolApi(module: EmscriptenModule): KernelPoolApi {
  let nextPoolFile = 0;
  return {
    badkpv: (caller, name, comp, size, divby, type) => {
      const c = encodedPoolText(caller, "badkpv caller");
      const k = encodedPoolText(name, "badkpv name");
      const op = encodedPoolText(comp, "badkpv comp");
      assertSpiceInt32(size, "badkpv size");
      assertSpiceInt32(divby, "badkpv divby");
      const ch = poolTypeChar(type);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, c.length + 1, k.length + 1, op.length + 1, 4],
        (err, cp, kp, optr, out) => {
          putPoolText(module, cp, c);
          putPoolText(module, kp, k);
          putPoolText(module, optr, op);
          checkPoolStatus(
            module,
            module._tspice_badkpv(
              cp,
              kp,
              optr,
              size,
              divby,
              ch,
              out,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          return module.HEAP32[out / 4] !== 0;
        },
      );
    },
    bodvcd: (body, item, maxn) => {
      assertSpiceInt32(body, "bodvcd body");
      assertSpiceInt32(maxn, "bodvcd maxn");
      const b = encodedPoolText(item, "bodvcd item");
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          b.length + 1,
          4,
          8 * Math.max(1, Math.min(maxn, 400000)),
        ],
        (err, ip, dim, values) => {
          putPoolText(module, ip, b);
          checkPoolStatus(
            module,
            module._tspice_bodvcd(
              body,
              ip,
              maxn,
              dim,
              values,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          return bodyResult(module, maxn, dim, values);
        },
      );
    },
    bodvrd: (body, item, maxn) => {
      assertSpiceInt32(maxn, "bodvrd maxn");
      const b = encodedPoolText(body, "bodvrd body");
      const i = encodedPoolText(item, "bodvrd item");
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          b.length + 1,
          i.length + 1,
          4,
          8 * Math.max(1, Math.min(maxn, 400000)),
        ],
        (err, bp, ip, dim, values) => {
          putPoolText(module, bp, b);
          putPoolText(module, ip, i);
          checkPoolStatus(
            module,
            module._tspice_bodvrd(
              bp,
              ip,
              maxn,
              dim,
              values,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          return bodyResult(module, maxn, dim, values);
        },
      );
    },
    clpool: () =>
      withAllocs(module, [WASM_ERR_MAX_BYTES], (err) => {
        checkPoolStatus(
          module,
          module._tspice_clpool(err, WASM_ERR_MAX_BYTES),
          err,
        );
      }),
    dvpool: (name) => {
      const b = encodedPoolText(name, "dvpool name");
      withAllocs(module, [WASM_ERR_MAX_BYTES, b.length + 1], (err, p) => {
        putPoolText(module, p, b);
        checkPoolStatus(
          module,
          module._tspice_dvpool(p, err, WASM_ERR_MAX_BYTES),
          err,
        );
      });
    },
    ldpool: (kernel) => {
      if (typeof kernel === "string") {
        spiceStringByteLength(kernel, "ldpool path", WASM_MAX_ALLOC_BYTES - 1);
        poolLoadPath(
          module,
          /^ *$/.test(kernel) ? kernel : resolveKernelPath(kernel),
        );
        return;
      }
      const source = poolSourceBytes(kernel);
      resolveKernelPath(source.path);
      // The public virtual namespace is /kernels. Exclusive creation prevents
      // a file staged by another caller from being overwritten or removed.
      const file = `/tmp/tspice-ldpool-${++nextPoolFile}.tpc`;
      module.FS.create(file, 0o600);
      try {
        module.FS.writeFile(file, source.bytes);
        poolLoadPath(module, file);
      } finally {
        module.FS.unlink(file);
      }
    },
    lmpool: (input) => {
      const { lines, width } = poolLineTable(input, WASM_MAX_ALLOC_BYTES);
      withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, width * Math.max(lines.length, 1)],
        (err, rows) => {
          writeFixedWidthUtf8CStringArray(module, rows, width, lines);
          checkPoolStatus(
            module,
            module._tspice_lmpool(
              rows,
              width,
              lines.length,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
        },
      );
    },
    stpool: (item, nth, contin, lenout) => {
      const i = encodedPoolText(item, "stpool item");
      const c = encodedPoolText(contin, "stpool contin");
      assertSpiceInt32(nth, "stpool nth");
      assertSpiceInt32(lenout, "stpool lenout");
      const capacity = Math.max(1, Math.min(1200001, lenout));
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, i.length + 1, c.length + 1, capacity, 4, 4],
        (err, ip, cp, text, size, found) => {
          putPoolText(module, ip, i);
          putPoolText(module, cp, c);
          checkPoolStatus(
            module,
            module._tspice_stpool(
              ip,
              nth,
              cp,
              lenout,
              text,
              size,
              found,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          if (!module.HEAP32[found / 4]) return { found: false };
          const out = module.HEAPU8.subarray(text, text + capacity);
          const end = out.indexOf(0);
          const full = module.HEAP32[size / 4];
          if (end < 0 || full === undefined || full < 0 || full > 1200000)
            throw new Error("Invalid stpool result");
          return {
            found: true,
            nthstr: strictPoolDecoder.decode(out.subarray(0, end)),
            size: full,
          };
        },
      );
    },
    szpool: (name) => {
      const b = encodedPoolText(name, "szpool name");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, b.length + 1, 4, 4],
        (err, p, n, found) => {
          putPoolText(module, p, b);
          checkPoolStatus(
            module,
            module._tspice_szpool(p, n, found, err, WASM_ERR_MAX_BYTES),
            err,
          );
          if (!module.HEAP32[found / 4]) return { found: false };
          const value = module.HEAP32[n / 4];
          if (value === undefined || value < 0)
            throw new Error("Invalid szpool result");
          return { found: true, n: value };
        },
      );
    },
    gdpool: (name, start, room) => tspiceCallGdpool(module, name, start, room),
    gipool: (name, start, room) => tspiceCallGipool(module, name, start, room),
    gcpool: (name, start, room) => tspiceCallGcpool(module, name, start, room),
    gnpool: (template, start, room) =>
      tspiceCallGnpool(module, template, start, room),
    dtpool: (name) => tspiceCallDtpool(module, name),

    pdpool: (name, values) => tspiceCallPdpool(module, name, values),
    pipool: (name, values) => tspiceCallPipool(module, name, values),
    pcpool: (name, values) => tspiceCallPcpool(module, name, values),

    swpool: (agent, names) => tspiceCallSwpool(module, agent, names),
    cvpool: (agent) => tspiceCallCvpool(module, agent),
    expool: (name) => tspiceCallExpool(module, name),
  } satisfies KernelPoolApi;
}
