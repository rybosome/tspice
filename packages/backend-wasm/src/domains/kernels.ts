import type {
  Found,
  KernelData,
  KernelKind,
  KernelSource,
  KernelsApi,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { tspiceCall0, tspiceCall1Path } from "../codec/calls.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import type { WasmFsApi } from "../runtime/fs.js";
import { resolveKernelPath, writeKernelSource } from "../runtime/fs.js";

function tspiceCallKtotal(module: EmscriptenModule, kind: KernelKind): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const kindPtr = writeUtf8CString(module, kind);
  const outCountPtr = module._malloc(4);
  if (!errPtr || !kindPtr || !outCountPtr) {
    if (outCountPtr) module._free(outCountPtr);
    if (kindPtr) module._free(kindPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[outCountPtr >> 2] = 0;
    const result = module._tspice_ktotal(kindPtr, outCountPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAP32[outCountPtr >> 2] ?? 0;
  } finally {
    module._free(outCountPtr);
    module._free(kindPtr);
    module._free(errPtr);
  }
}

function tspiceCallKdata(
  module: EmscriptenModule,
  which: number,
  kind: KernelKind,
): Found<KernelData> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const kindPtr = writeUtf8CString(module, kind);

  const fileMaxBytes = 2048;
  const filtypMaxBytes = 256;
  const sourceMaxBytes = 2048;
  const filePtr = module._malloc(fileMaxBytes);
  const filtypPtr = module._malloc(filtypMaxBytes);
  const sourcePtr = module._malloc(sourceMaxBytes);
  const handlePtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !kindPtr || !filePtr || !filtypPtr || !sourcePtr || !handlePtr || !foundPtr) {
    for (const ptr of [foundPtr, handlePtr, sourcePtr, filtypPtr, filePtr, kindPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[handlePtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;

    const result = module._tspice_kdata(
      which,
      kindPtr,
      filePtr,
      fileMaxBytes,
      filtypPtr,
      filtypMaxBytes,
      sourcePtr,
      sourceMaxBytes,
      handlePtr,
      foundPtr,
      errPtr,
      errMaxBytes,
    );

    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }

    return {
      found: true,
      file: module.UTF8ToString(filePtr, fileMaxBytes).trim(),
      filtyp: module.UTF8ToString(filtypPtr, filtypMaxBytes).trim(),
      source: module.UTF8ToString(sourcePtr, sourceMaxBytes).trim(),
      handle: module.HEAP32[handlePtr >> 2] ?? 0,
    };
  } finally {
    module._free(foundPtr);
    module._free(handlePtr);
    module._free(sourcePtr);
    module._free(filtypPtr);
    module._free(filePtr);
    module._free(kindPtr);
    module._free(errPtr);
  }
}

export function createKernelsApi(module: EmscriptenModule, fs: WasmFsApi): KernelsApi {
  return {
    furnsh: (kernel: KernelSource) => {
      if (typeof kernel === "string") {
        tspiceCall1Path(module, module._tspice_furnsh, resolveKernelPath(kernel));
        return;
      }

      const path = writeKernelSource(module, fs, kernel);
      tspiceCall1Path(module, module._tspice_furnsh, path);
    },
    unload: (path: string) => {
      tspiceCall1Path(module, module._tspice_unload, resolveKernelPath(path));
    },
    kclear: () => {
      tspiceCall0(module, module._tspice_kclear);
    },
    ktotal: (kind: KernelKind = "ALL") => tspiceCallKtotal(module, kind),
    kdata: (which: number, kind: KernelKind = "ALL") => tspiceCallKdata(module, which, kind),
  };
}
