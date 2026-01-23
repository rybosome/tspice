import type {
  AbCorr,
  Found,
  KernelData,
  KernelKind,
  KernelSource,
  SpkezrResult,
  SpkposResult,
  SpiceBackendWasm,
  SpiceMatrix3x3,
  SpiceMatrix6x6,
  SpiceStateVector,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";

export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;
};

export const WASM_JS_FILENAME = "tspice_backend_wasm.js" as const;
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm" as const;

type EmscriptenModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;

  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF64: Float64Array;
  _tspice_tkvrsn_toolkit(
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_furnsh(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_unload(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kclear(errPtr: number, errMaxBytes: number): number;
  _tspice_ktotal(kindPtr: number, outCountPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kdata(
    which: number,
    kindPtr: number,
    filePtr: number,
    fileMaxBytes: number,
    filtypPtr: number,
    filtypMaxBytes: number,
    sourcePtr: number,
    sourceMaxBytes: number,
    handlePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_str2et(utcPtr: number, outEtPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_et2utc(
    et: number,
    formatPtr: number,
    prec: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_timout(
    et: number,
    picturePtr: number,
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_scs2e(sc: number, sclkchPtr: number, outEtPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_sce2s(
    sc: number,
    et: number,
    outSclkchPtr: number,
    outSclkchMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    refPtr: number,
    outCmatPtr: number,
    outClkoutPtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    refPtr: number,
    outCmatPtr: number,
    outAvPtr: number,
    outClkoutPtr: number,
    outFoundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_bodn2c(namePtr: number, outCodePtr: number, foundPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_bodc2n(
    code: number,
    outNamePtr: number,
    outNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_namfrm(
    frameNamePtr: number,
    outFrameIdPtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_frmnam(
    frameId: number,
    outFrameNamePtr: number,
    outFrameNameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cidfrm(
    center: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_cnmfrm(
    centerNamePtr: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_pxform(
    fromPtr: number,
    toPtr: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_sxform(
    fromPtr: number,
    toPtr: number,
    et: number,
    outPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkezr(
    targetPtr: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    obsPtr: number,
    outStatePtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
  _tspice_spkpos(
    targetPtr: number,
    et: number,
    refPtr: number,
    abcorrPtr: number,
    obsPtr: number,
    outPosPtr: number,
    outLtPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FS: any;
};

function writeUtf8CString(module: EmscriptenModule, value: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  const ptr = module._malloc(encoded.length + 1);
  if (!ptr) {
    throw new Error("WASM malloc failed");
  }
  module.HEAPU8.set(encoded, ptr);
  module.HEAPU8[ptr + encoded.length] = 0;
  return ptr;
}

function throwWasmSpiceError(
  module: EmscriptenModule,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): never {
  const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
  throw new Error(message || `CSPICE call failed with code ${code}`);
}

function tspiceCall0(
  module: EmscriptenModule,
  fn: (errPtr: number, errMaxBytes: number) => number,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  if (!errPtr) {
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(errPtr);
  }
}

function tspiceCall1Path(
  module: EmscriptenModule,
  fn: (pathPtr: number, errPtr: number, errMaxBytes: number) => number,
  path: string,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const pathPtr = writeUtf8CString(module, path);
  if (!errPtr || !pathPtr) {
    if (pathPtr) module._free(pathPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(pathPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(pathPtr);
    module._free(errPtr);
  }
}

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

  if (
    !errPtr ||
    !kindPtr ||
    !filePtr ||
    !filtypPtr ||
    !sourcePtr ||
    !handlePtr ||
    !foundPtr
  ) {
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

function tspiceCallStr2et(module: EmscriptenModule, utc: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const utcPtr = writeUtf8CString(module, utc);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !utcPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, utcPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_str2et(utcPtr, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(utcPtr);
    module._free(errPtr);
  }
}

function tspiceCallEt2utc(
  module: EmscriptenModule,
  et: number,
  format: string,
  prec: number,
): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const formatPtr = writeUtf8CString(module, format);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !formatPtr || !outPtr) {
    for (const ptr of [outPtr, formatPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_et2utc(et, formatPtr, prec, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(formatPtr);
    module._free(errPtr);
  }
}

function tspiceCallTimout(module: EmscriptenModule, et: number, picture: string): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const picturePtr = writeUtf8CString(module, picture);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !picturePtr || !outPtr) {
    for (const ptr of [outPtr, picturePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_timout(et, picturePtr, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(picturePtr);
    module._free(errPtr);
  }
}

function tspiceCallScs2e(module: EmscriptenModule, sc: number, sclkch: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const sclkchPtr = writeUtf8CString(module, sclkch);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !sclkchPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, sclkchPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_scs2e(sc, sclkchPtr, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(sclkchPtr);
    module._free(errPtr);
  }
}

function tspiceCallSce2s(module: EmscriptenModule, sc: number, et: number): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 256;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !outPtr) {
    for (const ptr of [outPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_sce2s(sc, et, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(errPtr);
  }
}

function tspiceCallCkgp(
  module: EmscriptenModule,
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): Found<{ cmat: SpiceMatrix3x3; clkout: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const refPtr = writeUtf8CString(module, ref);
  const outCmatPtr = module._malloc(9 * 8);
  const outClkoutPtr = module._malloc(8);
  const outFoundPtr = module._malloc(4);

  if (!errPtr || !refPtr || !outCmatPtr || !outClkoutPtr || !outFoundPtr) {
    for (const ptr of [outFoundPtr, outClkoutPtr, outCmatPtr, refPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outClkoutPtr >> 3] = 0;
    module.HEAP32[outFoundPtr >> 2] = 0;

    const result = module._tspice_ckgp(
      inst,
      sclkdp,
      tol,
      refPtr,
      outCmatPtr,
      outClkoutPtr,
      outFoundPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const found = (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }

    const cmat = Array.from(
      module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9),
    ) as unknown as SpiceMatrix3x3;
    const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
    return { found: true, cmat, clkout };
  } finally {
    module._free(outFoundPtr);
    module._free(outClkoutPtr);
    module._free(outCmatPtr);
    module._free(refPtr);
    module._free(errPtr);
  }
}

function tspiceCallCkgpav(
  module: EmscriptenModule,
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): Found<{ cmat: SpiceMatrix3x3; av: SpiceVector3; clkout: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const refPtr = writeUtf8CString(module, ref);
  const outCmatPtr = module._malloc(9 * 8);
  const outAvPtr = module._malloc(3 * 8);
  const outClkoutPtr = module._malloc(8);
  const outFoundPtr = module._malloc(4);

  if (!errPtr || !refPtr || !outCmatPtr || !outAvPtr || !outClkoutPtr || !outFoundPtr) {
    for (const ptr of [outFoundPtr, outClkoutPtr, outAvPtr, outCmatPtr, refPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outClkoutPtr >> 3] = 0;
    module.HEAP32[outFoundPtr >> 2] = 0;

    const result = module._tspice_ckgpav(
      inst,
      sclkdp,
      tol,
      refPtr,
      outCmatPtr,
      outAvPtr,
      outClkoutPtr,
      outFoundPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const found = (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }

    const cmat = Array.from(
      module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9),
    ) as unknown as SpiceMatrix3x3;
    const av = Array.from(
      module.HEAPF64.subarray(outAvPtr >> 3, (outAvPtr >> 3) + 3),
    ) as unknown as SpiceVector3;
    const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
    return { found: true, cmat, av, clkout };
  } finally {
    module._free(outFoundPtr);
    module._free(outClkoutPtr);
    module._free(outAvPtr);
    module._free(outCmatPtr);
    module._free(refPtr);
    module._free(errPtr);
  }
}

function tspiceCallFoundInt(
  module: EmscriptenModule,
  fn: (argPtr: number, outIntPtr: number, foundPtr: number, errPtr: number, errMaxBytes: number) => number,
  arg: string,
): Found<{ value: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const argPtr = writeUtf8CString(module, arg);
  const outPtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !argPtr || !outPtr || !foundPtr) {
    for (const ptr of [foundPtr, outPtr, argPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[outPtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = fn(argPtr, outPtr, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    return { found: true, value: module.HEAP32[outPtr >> 2] ?? 0 };
  } finally {
    module._free(foundPtr);
    module._free(outPtr);
    module._free(argPtr);
    module._free(errPtr);
  }
}

function tspiceCallFoundString(
  module: EmscriptenModule,
  fn: (
    code: number,
    outStrPtr: number,
    outStrMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ) => number,
  code: number,
): Found<{ value: string }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outMaxBytes = 256;
  const outPtr = module._malloc(outMaxBytes);
  const foundPtr = module._malloc(4);

  if (!errPtr || !outPtr || !foundPtr) {
    for (const ptr of [foundPtr, outPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = fn(code, outPtr, outMaxBytes, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    return { found: true, value: module.UTF8ToString(outPtr, outMaxBytes).trim() };
  } finally {
    module._free(foundPtr);
    module._free(outPtr);
    module._free(errPtr);
  }
}

function tspiceCallCidfrm(
  module: EmscriptenModule,
  fn: (
    center: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ) => number,
  center: number,
): Found<{ frcode: number; frname: string }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outNameMaxBytes = 256;
  const outNamePtr = module._malloc(outNameMaxBytes);
  const outCodePtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !outNamePtr || !outCodePtr || !foundPtr) {
    for (const ptr of [foundPtr, outCodePtr, outNamePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outNamePtr] = 0;
    module.HEAP32[outCodePtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = fn(center, outCodePtr, outNamePtr, outNameMaxBytes, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    return {
      found: true,
      frcode: module.HEAP32[outCodePtr >> 2] ?? 0,
      frname: module.UTF8ToString(outNamePtr, outNameMaxBytes).trim(),
    };
  } finally {
    module._free(foundPtr);
    module._free(outCodePtr);
    module._free(outNamePtr);
    module._free(errPtr);
  }
}

function tspiceCallCnmfrm(
  module: EmscriptenModule,
  fn: (
    centerNamePtr: number,
    outFrcodePtr: number,
    outFrnamePtr: number,
    outFrnameMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ) => number,
  centerName: string,
): Found<{ frcode: number; frname: string }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const centerNamePtr = writeUtf8CString(module, centerName);
  const outNameMaxBytes = 256;
  const outNamePtr = module._malloc(outNameMaxBytes);
  const outCodePtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !centerNamePtr || !outNamePtr || !outCodePtr || !foundPtr) {
    for (const ptr of [foundPtr, outCodePtr, outNamePtr, centerNamePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outNamePtr] = 0;
    module.HEAP32[outCodePtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = fn(centerNamePtr, outCodePtr, outNamePtr, outNameMaxBytes, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    return {
      found: true,
      frcode: module.HEAP32[outCodePtr >> 2] ?? 0,
      frname: module.UTF8ToString(outNamePtr, outNameMaxBytes).trim(),
    };
  } finally {
    module._free(foundPtr);
    module._free(outCodePtr);
    module._free(outNamePtr);
    module._free(centerNamePtr);
    module._free(errPtr);
  }
}

function tspiceCallPxform(module: EmscriptenModule, from: string, to: string, et: number): SpiceMatrix3x3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const fromPtr = writeUtf8CString(module, from);
  const toPtr = writeUtf8CString(module, to);
  const outPtr = module._malloc(9 * 8);

  if (!errPtr || !fromPtr || !toPtr || !outPtr) {
    for (const ptr of [outPtr, toPtr, fromPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_pxform(fromPtr, toPtr, et, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const out = Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 9));
    return out as unknown as SpiceMatrix3x3;
  } finally {
    module._free(outPtr);
    module._free(toPtr);
    module._free(fromPtr);
    module._free(errPtr);
  }
}

function tspiceCallSxform(module: EmscriptenModule, from: string, to: string, et: number): SpiceMatrix6x6 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const fromPtr = writeUtf8CString(module, from);
  const toPtr = writeUtf8CString(module, to);
  const outPtr = module._malloc(36 * 8);

  if (!errPtr || !fromPtr || !toPtr || !outPtr) {
    for (const ptr of [outPtr, toPtr, fromPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_sxform(fromPtr, toPtr, et, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const out = Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 36));
    return out as unknown as SpiceMatrix6x6;
  } finally {
    module._free(outPtr);
    module._free(toPtr);
    module._free(fromPtr);
    module._free(errPtr);
  }
}

function tspiceCallSpkezr(
  module: EmscriptenModule,
  target: string,
  et: number,
  ref: string,
  abcorr: string,
  obs: string,
): SpkezrResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const targetPtr = writeUtf8CString(module, target);
  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const obsPtr = writeUtf8CString(module, obs);
  const outStatePtr = module._malloc(6 * 8);
  const outLtPtr = module._malloc(8);

  if (!errPtr || !targetPtr || !refPtr || !abcorrPtr || !obsPtr || !outStatePtr || !outLtPtr) {
    for (const ptr of [outLtPtr, outStatePtr, obsPtr, abcorrPtr, refPtr, targetPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outLtPtr >> 3] = 0;
    const result = module._tspice_spkezr(
      targetPtr,
      et,
      refPtr,
      abcorrPtr,
      obsPtr,
      outStatePtr,
      outLtPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const state = Array.from(
      module.HEAPF64.subarray(outStatePtr >> 3, (outStatePtr >> 3) + 6),
    ) as unknown as SpiceStateVector;
    const lt = module.HEAPF64[outLtPtr >> 3] ?? 0;
    return { state, lt };
  } finally {
    module._free(outLtPtr);
    module._free(outStatePtr);
    module._free(obsPtr);
    module._free(abcorrPtr);
    module._free(refPtr);
    module._free(targetPtr);
    module._free(errPtr);
  }
}

function tspiceCallSpkpos(
  module: EmscriptenModule,
  target: string,
  et: number,
  ref: string,
  abcorr: string,
  obs: string,
): SpkposResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const targetPtr = writeUtf8CString(module, target);
  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const obsPtr = writeUtf8CString(module, obs);
  const outPosPtr = module._malloc(3 * 8);
  const outLtPtr = module._malloc(8);

  if (!errPtr || !targetPtr || !refPtr || !abcorrPtr || !obsPtr || !outPosPtr || !outLtPtr) {
    for (const ptr of [outLtPtr, outPosPtr, obsPtr, abcorrPtr, refPtr, targetPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outLtPtr >> 3] = 0;
    const result = module._tspice_spkpos(
      targetPtr,
      et,
      refPtr,
      abcorrPtr,
      obsPtr,
      outPosPtr,
      outLtPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const pos = Array.from(
      module.HEAPF64.subarray(outPosPtr >> 3, (outPosPtr >> 3) + 3),
    ) as unknown as SpiceVector3;
    const lt = module.HEAPF64[outLtPtr >> 3] ?? 0;
    return { pos, lt };
  } finally {
    module._free(outLtPtr);
    module._free(outPosPtr);
    module._free(obsPtr);
    module._free(abcorrPtr);
    module._free(refPtr);
    module._free(targetPtr);
    module._free(errPtr);
  }
}

function getToolkitVersion(module: EmscriptenModule): string {
  const outMaxBytes = 256;
  const errMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);
  const errPtr = module._malloc(errMaxBytes);

  if (!outPtr || !errPtr) {
    if (errPtr) {
      module._free(errPtr);
    }
    if (outPtr) {
      module._free(outPtr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_tkvrsn_toolkit(
      outPtr,
      outMaxBytes,
      errPtr,
      errMaxBytes,
    );

    if (result !== 0) {
      const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
      throw new Error(message || `CSPICE call failed with code ${result}`);
    }

    return module.UTF8ToString(outPtr, outMaxBytes);
  } finally {
    module._free(errPtr);
    module._free(outPtr);
  }
}

export async function createWasmBackend(
  options: CreateWasmBackendOptions = {},
): Promise<SpiceBackendWasm> {
  const defaultWasmUrl = new URL(`./${WASM_BINARY_FILENAME}`, import.meta.url);
  const wasmUrl = options.wasmUrl?.toString() ?? defaultWasmUrl.href;

  const moduleUrl = new URL(`./${WASM_JS_FILENAME}`, import.meta.url);

  let createEmscriptenModule: (opts: Record<string, unknown>) => Promise<unknown>;
  try {
    ({ default: createEmscriptenModule } = (await import(moduleUrl.href)) as {
      default: (opts: Record<string, unknown>) => Promise<unknown>;
    });
  } catch (error) {
    throw new Error(
      `Failed to load tspice WASM glue from ${moduleUrl.href}: ${String(error)}`,
    );
  }

  let module: EmscriptenModule;
  try {
    let instantiateWasmError: unknown;

    const emscriptenOpts: Record<string, unknown> = {
      locateFile(path: string, prefix: string) {
        if (path === WASM_BINARY_FILENAME) {
          return wasmUrl;
        }
        return `${prefix}${path}`;
      },
    };

    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    if (isNode && wasmUrl.startsWith("file:")) {
      // Emscripten's default Node loader expects a filesystem path, but our
      // `locateFile` returns a `file:` URL (from `import.meta.url`). Override
      // instantiation to load the bytes via Node fs.
      emscriptenOpts.instantiateWasm = (
        imports: unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        successCallback: (instance: any) => void,
      ) => {
        void (async () => {
          try {
            const [fs, { fileURLToPath }] = await Promise.all([
              import("node:fs"),
              import("node:url"),
            ]);

            const bytes = await fs.promises.readFile(fileURLToPath(wasmUrl));

            // `WebAssembly` types live in DOM lib defs, which we don't include.
            // Use `globalThis` to keep this package's TS config lean.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const webAssembly = (globalThis as any).WebAssembly as any;
            if (!webAssembly?.instantiate) {
              throw new Error("WebAssembly.instantiate is not available in this environment");
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { instance } = (await webAssembly.instantiate(bytes, imports)) as any;
            successCallback(instance);
          } catch (error) {
            instantiateWasmError = error;
            const message = error instanceof Error ? error.message : String(error);
            const errorMessage =
              `Failed to instantiate tspice WASM binary from ${wasmUrl}: ${message}. ` +
              "Note: Node fetch(file://...) is unsupported, so this must be loaded via fs.";

            // Emscripten requires us to either call `successCallback` or abort. If we just throw
            // here, module init can hang waiting on the "wasm-instantiate" run dependency.
            //
            // `imports` is the Emscripten `info` object (`{ env, wasi_snapshot_preview1 }`).
            // Calling `env.abort()` will reject the module's ready promise.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const abort = (imports as any)?.env?.abort as unknown;
            if (typeof abort === "function") {
              // Ensure the actual failure reason is visible even if the abort error is generic.
              // eslint-disable-next-line no-console
              console.error(errorMessage);

              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              (abort as any)();
              return;
            }

            throw new Error(errorMessage);
          }
        })();

        // Async instantiation sentinel (Emscripten pattern)
        return {};
      };
    }

    try {
      module = (await createEmscriptenModule(emscriptenOpts)) as EmscriptenModule;
    } catch (error) {
      if (instantiateWasmError) {
        const message =
          instantiateWasmError instanceof Error
            ? instantiateWasmError.message
            : String(instantiateWasmError);
        throw new Error(
          `Failed to instantiate tspice WASM binary from ${wasmUrl}: ${message}. ` +
            "Note: Node fetch(file://...) is unsupported, so this must be loaded via fs.",
        );
      }
      throw error;
    }
  } catch (error) {
    throw new Error(
      `Failed to initialize tspice WASM module (wasmUrl=${wasmUrl}): ${String(error)}`,
    );
  }

  if (
    typeof module._tspice_tkvrsn_toolkit !== "function" ||
    typeof module._malloc !== "function" ||
    typeof module._free !== "function" ||
    typeof module.UTF8ToString !== "function" ||
    typeof module._tspice_furnsh !== "function" ||
    typeof module._tspice_unload !== "function" ||
    typeof module._tspice_kclear !== "function" ||
    typeof module._tspice_ktotal !== "function" ||
    typeof module._tspice_kdata !== "function" ||
    typeof module._tspice_str2et !== "function" ||
    typeof module._tspice_et2utc !== "function" ||
    typeof module._tspice_timout !== "function" ||
    typeof module._tspice_scs2e !== "function" ||
    typeof module._tspice_sce2s !== "function" ||
    typeof module._tspice_ckgp !== "function" ||
    typeof module._tspice_ckgpav !== "function" ||
    typeof module._tspice_bodn2c !== "function" ||
    typeof module._tspice_bodc2n !== "function" ||
    typeof module._tspice_namfrm !== "function" ||
    typeof module._tspice_frmnam !== "function" ||
    typeof module._tspice_pxform !== "function" ||
    typeof module._tspice_sxform !== "function" ||
    typeof module._tspice_spkezr !== "function" ||
    typeof module._tspice_spkpos !== "function"
  ) {
    throw new Error("WASM module is missing expected exports");
  }

  // The toolkit version is constant for the lifetime of a loaded module.
  const toolkitVersion = getToolkitVersion(module);

  function writeFile(path: string, data: Uint8Array): void {
    const dir = path.split("/").slice(0, -1).join("/") || "/";
    if (dir && dir !== "/") {
      module.FS.mkdirTree(dir);
    }

    // Normalize to a tightly-sized, offset-0 view to avoid FS edge cases with Buffer pooling.
    const bytes =
      data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
        ? data
        : new Uint8Array(data);

    module.FS.writeFile(path, bytes);
  }

  const backend: SpiceBackendWasm = {
    kind: "wasm",

    spiceVersion: () => toolkitVersion,

    tkvrsn: (item) => {
      if (item !== "TOOLKIT") {
        throw new Error(`Unsupported tkvrsn item: ${item}`);
      }
      return toolkitVersion;
    },

    // Phase 1
    furnsh(kernel: KernelSource) {
      if (typeof kernel === "string") {
        tspiceCall1Path(module, module._tspice_furnsh, kernel);
        return;
      }

      writeFile(kernel.path, kernel.bytes);
      tspiceCall1Path(module, module._tspice_furnsh, kernel.path);
    },
    unload(path: string) {
      tspiceCall1Path(module, module._tspice_unload, path);
    },
    kclear() {
      tspiceCall0(module, module._tspice_kclear);
    },

    ktotal(kind: KernelKind = "ALL") {
      return tspiceCallKtotal(module, kind);
    },

    kdata(which: number, kind: KernelKind = "ALL") {
      return tspiceCallKdata(module, which, kind);
    },

    str2et(utc: string) {
      return tspiceCallStr2et(module, utc);
    },

    et2utc(et: number, format: string, prec: number) {
      return tspiceCallEt2utc(module, et, format, prec);
    },

    timout(et: number, picture: string) {
      return tspiceCallTimout(module, et, picture);
    },

    scs2e(sc: number, sclkch: string) {
      return tspiceCallScs2e(module, sc, sclkch);
    },

    sce2s(sc: number, et: number) {
      return tspiceCallSce2s(module, sc, et);
    },

    ckgp(inst: number, sclkdp: number, tol: number, ref: string) {
      return tspiceCallCkgp(module, inst, sclkdp, tol, ref);
    },

    ckgpav(inst: number, sclkdp: number, tol: number, ref: string) {
      return tspiceCallCkgpav(module, inst, sclkdp, tol, ref);
    },

    // Phase 2
    bodn2c(name: string) {
      const out = tspiceCallFoundInt(module, module._tspice_bodn2c, name);
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },
    bodc2n(code: number) {
      const out = tspiceCallFoundString(module, module._tspice_bodc2n, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },
    namfrm(name: string) {
      const out = tspiceCallFoundInt(module, module._tspice_namfrm, name);
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },
    frmnam(code: number) {
      const out = tspiceCallFoundString(module, module._tspice_frmnam, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },

    cidfrm(center: number) {
      return tspiceCallCidfrm(module, module._tspice_cidfrm, center);
    },

    cnmfrm(centerName: string) {
      return tspiceCallCnmfrm(module, module._tspice_cnmfrm, centerName);
    },

    // Phase 3
    spkezr(target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) {
      return tspiceCallSpkezr(module, target, et, ref, abcorr, observer);
    },

    spkpos(target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) {
      return tspiceCallSpkpos(module, target, et, ref, abcorr, observer);
    },

    pxform(from: string, to: string, et: number) {
      return tspiceCallPxform(module, from, to, et);
    },
    sxform(from: string, to: string, et: number) {
      return tspiceCallSxform(module, from, to, et);
    },

    // WASM-only
    writeFile,
    loadKernel(path: string, data: Uint8Array) {
      const resolvedPath = path.startsWith("/") ? path : `/kernels/${path}`;
      writeFile(resolvedPath, data);
      tspiceCall1Path(module, module._tspice_furnsh, resolvedPath);
    },
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackendWasm & { __ktotalAll(): number }).__ktotalAll = () => backend.ktotal("ALL");

  return backend;
}
