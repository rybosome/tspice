import type {
  Found,
  FramesApi,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import { brandMat3RowMajor } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { tspiceCallFoundInt, tspiceCallFoundString } from "../codec/found.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

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

function tspiceCallFrinfo(
  module: EmscriptenModule,
  frameId: number,
): Found<{ center: number; frameClass: number; classId: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outCenterPtr = module._malloc(4);
  const outFrameClassPtr = module._malloc(4);
  const outClassIdPtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !outCenterPtr || !outFrameClassPtr || !outClassIdPtr || !foundPtr) {
    for (const ptr of [foundPtr, outClassIdPtr, outFrameClassPtr, outCenterPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[outCenterPtr >> 2] = 0;
    module.HEAP32[outFrameClassPtr >> 2] = 0;
    module.HEAP32[outClassIdPtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;

    const result = module._tspice_frinfo(
      frameId,
      outCenterPtr,
      outFrameClassPtr,
      outClassIdPtr,
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
      center: module.HEAP32[outCenterPtr >> 2] ?? 0,
      frameClass: module.HEAP32[outFrameClassPtr >> 2] ?? 0,
      classId: module.HEAP32[outClassIdPtr >> 2] ?? 0,
    };
  } finally {
    module._free(foundPtr);
    module._free(outClassIdPtr);
    module._free(outFrameClassPtr);
    module._free(outCenterPtr);
    module._free(errPtr);
  }
}

function tspiceCallCcifrm(
  module: EmscriptenModule,
  frameClass: number,
  classId: number,
): Found<{ frcode: number; frname: string; center: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outNameMaxBytes = 256;
  const outNamePtr = module._malloc(outNameMaxBytes);
  const outFrcodePtr = module._malloc(4);
  const outCenterPtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !outNamePtr || !outFrcodePtr || !outCenterPtr || !foundPtr) {
    for (const ptr of [foundPtr, outCenterPtr, outFrcodePtr, outNamePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outNamePtr] = 0;
    module.HEAP32[outFrcodePtr >> 2] = 0;
    module.HEAP32[outCenterPtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;

    const result = module._tspice_ccifrm(
      frameClass,
      classId,
      outFrcodePtr,
      outNamePtr,
      outNameMaxBytes,
      outCenterPtr,
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
      frcode: module.HEAP32[outFrcodePtr >> 2] ?? 0,
      frname: module.UTF8ToString(outNamePtr, outNameMaxBytes).trim(),
      center: module.HEAP32[outCenterPtr >> 2] ?? 0,
    };
  } finally {
    module._free(foundPtr);
    module._free(outCenterPtr);
    module._free(outFrcodePtr);
    module._free(outNamePtr);
    module._free(errPtr);
  }
}

function tspiceCallCkgp(
  module: EmscriptenModule,
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): Found<{ cmat: Mat3RowMajor; clkout: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const refPtr = writeUtf8CString(module, ref);
  const outCmatPtr = module._malloc(9 * 8);
  const outClkoutPtr = module._malloc(8);
  const foundPtr = module._malloc(4);
  if (!errPtr || !refPtr || !outCmatPtr || !outClkoutPtr || !foundPtr) {
    for (const ptr of [foundPtr, outClkoutPtr, outCmatPtr, refPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outClkoutPtr >> 3] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = module._tspice_ckgp(inst, sclkdp, tol, refPtr, outCmatPtr, outClkoutPtr, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    const cmat = brandMat3RowMajor(
      Array.from(module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9)),
      { label: "ckgp().cmat" },
    );
    const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
    return { found: true, cmat, clkout };
  } finally {
    module._free(foundPtr);
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
): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const refPtr = writeUtf8CString(module, ref);
  const outCmatPtr = module._malloc(9 * 8);
  const outAvPtr = module._malloc(3 * 8);
  const outClkoutPtr = module._malloc(8);
  const foundPtr = module._malloc(4);
  if (!errPtr || !refPtr || !outCmatPtr || !outAvPtr || !outClkoutPtr || !foundPtr) {
    for (const ptr of [foundPtr, outClkoutPtr, outAvPtr, outCmatPtr, refPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outClkoutPtr >> 3] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = module._tspice_ckgpav(
      inst,
      sclkdp,
      tol,
      refPtr,
      outCmatPtr,
      outAvPtr,
      outClkoutPtr,
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
    const cmat = brandMat3RowMajor(
      Array.from(module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9)),
      { label: "ckgpav().cmat" },
    );
    const av = Array.from(
      module.HEAPF64.subarray(outAvPtr >> 3, (outAvPtr >> 3) + 3),
    ) as unknown as SpiceVector3;
    const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
    return { found: true, cmat, av, clkout };
  } finally {
    module._free(foundPtr);
    module._free(outClkoutPtr);
    module._free(outAvPtr);
    module._free(outCmatPtr);
    module._free(refPtr);
    module._free(errPtr);
  }
}

function tspiceCallPxform(module: EmscriptenModule, from: string, to: string, et: number): Mat3RowMajor {
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
    return brandMat3RowMajor(out, { label: "pxform()" });
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

export function createFramesApi(module: EmscriptenModule): FramesApi {
  return {
    namfrm: (name: string) => {
      const out = tspiceCallFoundInt(module, module._tspice_namfrm, name);
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },
    frmnam: (code: number) => {
      const out = tspiceCallFoundString(module, module._tspice_frmnam, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },

    cidfrm: (center: number) => tspiceCallCidfrm(module, module._tspice_cidfrm, center),
    cnmfrm: (centerName: string) => tspiceCallCnmfrm(module, module._tspice_cnmfrm, centerName),
    frinfo: (frameId: number) => tspiceCallFrinfo(module, frameId),
    ccifrm: (frameClass: number, classId: number) => tspiceCallCcifrm(module, frameClass, classId),


    ckgp: (inst: number, sclkdp: number, tol: number, ref: string) => tspiceCallCkgp(module, inst, sclkdp, tol, ref),
    ckgpav: (inst: number, sclkdp: number, tol: number, ref: string) =>
      tspiceCallCkgpav(module, inst, sclkdp, tol, ref),

    pxform: (from: string, to: string, et: number) => tspiceCallPxform(module, from, to, et),
    sxform: (from: string, to: string, et: number) => tspiceCallSxform(module, from, to, et),
  };
}
