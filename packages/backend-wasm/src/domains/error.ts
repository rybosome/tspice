import type { ErrorApi } from "@rybosome/tspice-backend-contract";
import {
  policyArguments,
  assertGetmsgWhich,
  assertSpiceInt32,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withMalloc, withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function writeSpiceString(
  module: EmscriptenModule,
  ptr: number,
  value: string,
  bytes: number,
) {
  const start = ptr >>> 0;
  encoder.encodeInto(value, module.HEAPU8.subarray(start, start + bytes));
  module.HEAPU8[start + bytes] = 0;
}

/** Create an {@link ErrorApi} implementation backed by a WASM Emscripten module. */
export function createErrorApi(module: EmscriptenModule): ErrorApi {
  function check(status: number, err: number) {
    if (status !== 0)
      throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
  }

  function readTrace(
    capacity: number,
    full: number,
    invoke: (length: number, out: number, err: number) => number,
  ) {
    assertSpiceInt32(capacity, "trace capacity");
    const length = Math.min(capacity, full);
    return withAllocs(
      module,
      [Math.max(1, length), WASM_ERR_MAX_BYTES],
      (out, err) => {
        check(invoke(length, out, err), err);
        const start = out >>> 0,
          bytes = module.HEAPU8.subarray(start, start + length);
        const nul = bytes.indexOf(0);
        if (nul < 0) throw new Error("CSPICE trace has no NUL terminator");
        return decoder.decode(bytes.subarray(0, nul));
      },
    );
  }

  function readPolicy(
    op: string,
    value: string,
    capacity: number,
    invoke: (
      op: number,
      value: number,
      capacity: number,
      out: number,
      err: number,
    ) => number,
  ) {
    const opBytes = spiceStringByteLength(op, "operation");
    const valueBytes = spiceStringByteLength(value, "policy value");
    const physical = Math.max(capacity, 1);
    return withAllocs(
      module,
      [opBytes + 1, valueBytes + 1, physical, WASM_ERR_MAX_BYTES],
      (o, v, out, err) => {
        writeSpiceString(module, o, op, opBytes);
        writeSpiceString(module, v, value, valueBytes);
        check(invoke(o, v, capacity, out, err), err);
        const start = out >>> 0;
        const bytes = module.HEAPU8.subarray(start, start + physical);
        const end = bytes.indexOf(0);
        if (end < 0)
          throw new Error("CSPICE error policy output has no NUL terminator");
        return decoder.decode(bytes.subarray(0, end));
      },
    );
  }
  function errdev(op: "GET", capacity?: number): string;
  function errdev(op: "SET", value: string): void;
  function errdev(
    op: "GET" | "SET",
    argument?: number | string,
  ): string | void {
    const call = policyArguments(op, argument, 256);
    const result = readPolicy(
      op,
      call.value,
      call.capacity,
      (o, v, l, out, err) =>
        module._tspice_errdev(o, v, l, out, err, WASM_ERR_MAX_BYTES),
    );
    if (!call.set) return result;
  }

  function errprt(op: "GET", capacity?: number): string;
  function errprt(op: "SET", value: string): void;
  function errprt(
    op: "GET" | "SET",
    argument?: number | string,
  ): string | void {
    const call = policyArguments(op, argument, 41);
    const result = readPolicy(
      op,
      call.value,
      call.capacity,
      (o, v, l, out, err) =>
        module._tspice_errprt(o, v, l, out, err, WASM_ERR_MAX_BYTES),
    );
    if (!call.set) return result;
  }

  return {
    errdev,
    errprt,
    trcoff: () =>
      withMalloc(module, WASM_ERR_MAX_BYTES, (err) => {
        check(module._tspice_trcoff(err, WASM_ERR_MAX_BYTES), err);
      }),
    errch: (marker, value) => {
      const m = spiceStringByteLength(marker, "marker"),
        v = spiceStringByteLength(value, "value");
      withAllocs(module, [m + 1, v + 1, WASM_ERR_MAX_BYTES], (mp, vp, err) => {
        writeSpiceString(module, mp, marker, m);
        writeSpiceString(module, vp, value, v);
        check(module._tspice_errch(mp, vp, err, WASM_ERR_MAX_BYTES), err);
      });
    },
    errdp: (marker, value) => {
      const m = spiceStringByteLength(marker, "marker");
      if (!Number.isFinite(value))
        throw new TypeError("errdp expects a finite number");
      withAllocs(module, [m + 1, WASM_ERR_MAX_BYTES], (mp, err) => {
        writeSpiceString(module, mp, marker, m);
        check(module._tspice_errdp(mp, value, err, WASM_ERR_MAX_BYTES), err);
      });
    },
    errint: (marker, value) => {
      const m = spiceStringByteLength(marker, "marker");
      assertSpiceInt32(value, "value");
      withAllocs(module, [m + 1, WASM_ERR_MAX_BYTES], (mp, err) => {
        writeSpiceString(module, mp, marker, m);
        check(module._tspice_errint(mp, value, err, WASM_ERR_MAX_BYTES), err);
      });
    },
    qcktrc: (tracelen = 4096) =>
      readTrace(tracelen, 4096, (length, out, err) =>
        module._tspice_qcktrc(length, out, err, WASM_ERR_MAX_BYTES),
      ),
    return: () =>
      withAllocs(module, [4, WASM_ERR_MAX_BYTES], (out, err) => {
        check(module._tspice_return(out, err, WASM_ERR_MAX_BYTES), err);
        return module.HEAP32[out >>> 2] !== 0;
      }),
    trcdep: () =>
      withAllocs(module, [4, WASM_ERR_MAX_BYTES], (out, err) => {
        check(module._tspice_trcdep(out, err, WASM_ERR_MAX_BYTES), err);
        return module.HEAP32[out >>> 2]!;
      }),
    trcnam: (index, namlen = 33) => {
      assertSpiceInt32(index, "index");
      return readTrace(namlen, 33, (length, out, err) =>
        module._tspice_trcnam(index, length, out, err, WASM_ERR_MAX_BYTES),
      );
    },
    failed: () => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      return withAllocs(module, [4, errMaxBytes], (outFailedPtr, errPtr) => {
        module.HEAP32[outFailedPtr >> 2] = 0;
        const result = module._tspice_failed(outFailedPtr, errPtr, errMaxBytes);
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, errMaxBytes, result);
        }
        return (module.HEAP32[outFailedPtr >> 2] ?? 0) !== 0;
      });
    },

    reset: () => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      withMalloc(module, errMaxBytes, (errPtr) => {
        const result = module._tspice_reset(errPtr, errMaxBytes);
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, errMaxBytes, result);
        }
      });
    },

    getmsg: (which) => {
      assertGetmsgWhich(which);
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const outMaxBytes = WASM_ERR_MAX_BYTES;
      const whichPtr = writeUtf8CString(module, which);
      try {
        return withAllocs(
          module,
          [outMaxBytes, errMaxBytes],
          (outPtr, errPtr) => {
            module.HEAPU8[outPtr] = 0;
            const result = module._tspice_getmsg(
              whichPtr,
              outPtr,
              outMaxBytes,
              errPtr,
              errMaxBytes,
            );
            if (result !== 0) {
              throwWasmSpiceError(module, errPtr, errMaxBytes, result);
            }
            return module.UTF8ToString(outPtr, outMaxBytes).trimEnd();
          },
        );
      } finally {
        module._free(whichPtr);
      }
    },

    setmsg: (message) => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const messagePtr = writeUtf8CString(module, message);
      try {
        withMalloc(module, errMaxBytes, (errPtr) => {
          const result = module._tspice_setmsg(messagePtr, errPtr, errMaxBytes);
          if (result !== 0) {
            throwWasmSpiceError(module, errPtr, errMaxBytes, result);
          }
        });
      } finally {
        module._free(messagePtr);
      }
    },

    sigerr: (short) => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const shortPtr = writeUtf8CString(module, short);
      try {
        withMalloc(module, errMaxBytes, (errPtr) => {
          const result = module._tspice_sigerr(shortPtr, errPtr, errMaxBytes);
          if (result !== 0) {
            throwWasmSpiceError(module, errPtr, errMaxBytes, result);
          }
        });
      } finally {
        module._free(shortPtr);
      }
    },

    chkin: (name) => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const namePtr = writeUtf8CString(module, name);
      try {
        withMalloc(module, errMaxBytes, (errPtr) => {
          const result = module._tspice_chkin(namePtr, errPtr, errMaxBytes);
          if (result !== 0) {
            throwWasmSpiceError(module, errPtr, errMaxBytes, result);
          }
        });
      } finally {
        module._free(namePtr);
      }
    },

    chkout: (name) => {
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const namePtr = writeUtf8CString(module, name);
      try {
        withMalloc(module, errMaxBytes, (errPtr) => {
          const result = module._tspice_chkout(namePtr, errPtr, errMaxBytes);
          if (result !== 0) {
            throwWasmSpiceError(module, errPtr, errMaxBytes, result);
          }
        });
      } finally {
        module._free(namePtr);
      }
    },
  };
}
