import type { ErrorApi } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withMalloc, withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

export function createErrorApi(module: EmscriptenModule): ErrorApi {
  return {
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
      const errMaxBytes = WASM_ERR_MAX_BYTES;
      const outMaxBytes = 2048;
      const whichPtr = writeUtf8CString(module, which);
      try {
        return withAllocs(module, [outMaxBytes, errMaxBytes], (outPtr, errPtr) => {
          module.HEAPU8[outPtr] = 0;
          const result = module._tspice_getmsg(whichPtr, outPtr, outMaxBytes, errPtr, errMaxBytes);
          if (result !== 0) {
            throwWasmSpiceError(module, errPtr, errMaxBytes, result);
          }
          return module.UTF8ToString(outPtr, outMaxBytes).trim();
        });
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
