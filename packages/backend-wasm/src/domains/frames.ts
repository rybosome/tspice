import type {
  CkCoverageLevel,
  CkCoverageTimeSystem,
  Found,
  FramesApi,
  Mat3RowMajor,
  SpiceIntCell,
  SpiceMatrix6x6,
  SpiceVector3,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
  brandMat6RowMajor,
  brandVec3,
  brandMat3RowMajor,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs } from "../codec/alloc.js";
import { tspiceCallFoundInt, tspiceCallFoundString } from "../codec/found.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";

import {
  assertWasmOwnedCellHandle,
  assertWasmOwnedWindowHandle,
  wasmCellPointer,
  wasmWindowPointer,
} from "./cells-windows.js";

function copyStateMatrix(value: unknown): SpiceMatrix6x6 {
  const matrix = brandMat6RowMajor(value, { label: "sxform()" });
  return [
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5],
    matrix[6],
    matrix[7],
    matrix[8],
    matrix[9],
    matrix[10],
    matrix[11],
    matrix[12],
    matrix[13],
    matrix[14],
    matrix[15],
    matrix[16],
    matrix[17],
    matrix[18],
    matrix[19],
    matrix[20],
    matrix[21],
    matrix[22],
    matrix[23],
    matrix[24],
    matrix[25],
    matrix[26],
    matrix[27],
    matrix[28],
    matrix[29],
    matrix[30],
    matrix[31],
    matrix[32],
    matrix[33],
    matrix[34],
    matrix[35],
  ];
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
    const result = fn(
      center,
      outCodePtr,
      outNamePtr,
      outNameMaxBytes,
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
      frcode: module.HEAP32[outCodePtr >> 2] ?? 0,
      frname: readFixedWidthCString(module, outNamePtr, outNameMaxBytes),
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
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const outNameMaxBytes = 256;
  const centerNamePtr = writeUtf8CString(module, centerName);
  try {
    return withAllocs(
      module,
      [errMaxBytes, outNameMaxBytes, 4, 4],
      (errPtr, outNamePtr, outCodePtr, foundPtr) => {
        module.HEAPU8[outNamePtr] = 0;
        module.HEAP32[outCodePtr >> 2] = 0;
        module.HEAP32[foundPtr >> 2] = 0;
        const result = fn(
          centerNamePtr,
          outCodePtr,
          outNamePtr,
          outNameMaxBytes,
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
          frcode: module.HEAP32[outCodePtr >> 2] ?? 0,
          frname: readFixedWidthCString(module, outNamePtr, outNameMaxBytes),
        };
      },
    );
  } finally {
    module._free(centerNamePtr);
  }
}

function tspiceCallFrinfo(
  module: EmscriptenModule,
  frameId: number,
): Found<{ center: number; frameClass: number; classId: number }> {
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, 4, 4, 4, 4],
    (errPtr, outCenterPtr, outFrameClassPtr, outClassIdPtr, foundPtr) => {
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
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
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
    },
  );
}

function tspiceCallCcifrm(
  module: EmscriptenModule,
  frameClass: number,
  classId: number,
): Found<{ frcode: number; frname: string; center: number }> {
  const outNameMaxBytes = 256;

  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, outNameMaxBytes, 4, 4, 4],
    (errPtr, outNamePtr, outFrcodePtr, outCenterPtr, foundPtr) => {
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
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }

      const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
      if (!found) {
        return { found: false };
      }

      return {
        found: true,
        frcode: module.HEAP32[outFrcodePtr >> 2] ?? 0,
        frname: readFixedWidthCString(module, outNamePtr, outNameMaxBytes),
        center: module.HEAP32[outCenterPtr >> 2] ?? 0,
      };
    },
  );
}

function tspiceCallCkgp(
  module: EmscriptenModule,
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): Found<{ cmat: Mat3RowMajor; clkout: number }> {
  const refPtr = writeUtf8CString(module, ref);
  try {
    const errMaxBytes = 2048;
    const errPtr = module._malloc(errMaxBytes);
    const outCmatPtr = module._malloc(9 * 8);
    const outClkoutPtr = module._malloc(8);
    const foundPtr = module._malloc(4);
    if (!errPtr || !refPtr || !outCmatPtr || !outClkoutPtr || !foundPtr) {
      for (const ptr of [foundPtr, outClkoutPtr, outCmatPtr, refPtr, errPtr]) {
        if (ptr && ptr !== refPtr) module._free(ptr);
      }
      throw new Error("WASM malloc failed");
    }

    try {
      module.HEAPF64[outClkoutPtr >> 3] = 0;
      module.HEAP32[foundPtr >> 2] = 0;
      const result = module._tspice_ckgp(
        inst,
        sclkdp,
        tol,
        refPtr,
        outCmatPtr,
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
        Array.from(
          module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9),
        ),
        { label: "ckgp().cmat" },
      );
      const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
      return { found: true, cmat, clkout };
    } finally {
      module._free(foundPtr);
      module._free(outClkoutPtr);
      module._free(outCmatPtr);
      module._free(errPtr);
    }
  } finally {
    module._free(refPtr);
  }
}

function tspiceCallCkgpav(
  module: EmscriptenModule,
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): Found<{ cmat: Mat3RowMajor; av: SpiceVector3; clkout: number }> {
  const refPtr = writeUtf8CString(module, ref);
  try {
    const errMaxBytes = 2048;
    const errPtr = module._malloc(errMaxBytes);
    const outCmatPtr = module._malloc(9 * 8);
    const outAvPtr = module._malloc(3 * 8);
    const outClkoutPtr = module._malloc(8);
    const foundPtr = module._malloc(4);
    if (
      !errPtr ||
      !refPtr ||
      !outCmatPtr ||
      !outAvPtr ||
      !outClkoutPtr ||
      !foundPtr
    ) {
      for (const ptr of [
        foundPtr,
        outClkoutPtr,
        outAvPtr,
        outCmatPtr,
        refPtr,
        errPtr,
      ]) {
        if (ptr && ptr !== refPtr) module._free(ptr);
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
        Array.from(
          module.HEAPF64.subarray(outCmatPtr >> 3, (outCmatPtr >> 3) + 9),
        ),
        { label: "ckgpav().cmat" },
      );
      const values = brandVec3(
        module.HEAPF64.subarray(outAvPtr >> 3, (outAvPtr >> 3) + 3),
        { label: "ckgpav().av" },
      );
      const av: SpiceVector3 = [values[0], values[1], values[2]];
      const clkout = module.HEAPF64[outClkoutPtr >> 3] ?? 0;
      return { found: true, cmat, av, clkout };
    } finally {
      module._free(foundPtr);
      module._free(outClkoutPtr);
      module._free(outAvPtr);
      module._free(outCmatPtr);
      module._free(errPtr);
    }
  } finally {
    module._free(refPtr);
  }
}

// --- CK file query / management (read-only) --------------------------------

function tspiceCallCklpf(module: EmscriptenModule, ck: string): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outHandlePtr) => {
    const ckPathPtr = writeUtf8CString(module, resolveKernelPath(ck));
    if (!ckPathPtr) {
      throw new Error("WASM malloc failed");
    }

    try {
      module.HEAP32[outHandlePtr >> 2] = 0;
      const code = module._tspice_cklpf(
        ckPathPtr,
        outHandlePtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
      return module.HEAP32[outHandlePtr >> 2] ?? 0;
    } finally {
      module._free(ckPathPtr);
    }
  });
}

function tspiceCallCkupf(module: EmscriptenModule, handle: number): void {
  assertSpiceInt32NonNegative(handle, "ckupf(handle)");
  return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
    const code = module._tspice_ckupf(handle, errPtr, WASM_ERR_MAX_BYTES);
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  });
}

function tspiceCallCkobj(
  module: EmscriptenModule,
  ck: string,
  ids: SpiceIntCell,
): void {
  return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
    const ckPathPtr = writeUtf8CString(module, resolveKernelPath(ck));
    if (!ckPathPtr) {
      throw new Error("WASM malloc failed");
    }

    try {
      const code = module._tspice_ckobj(
        ckPathPtr,
        wasmCellPointer(module, ids, "ckobj()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
    } finally {
      module._free(ckPathPtr);
    }
  });
}

function tspiceCallCkcov(
  module: EmscriptenModule,
  ck: string,
  idcode: number,
  needav: boolean,
  level: CkCoverageLevel,
  tol: number,
  timsys: CkCoverageTimeSystem,
  cover: SpiceWindow,
): void {
  return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
    const ckPathPtr = writeUtf8CString(module, resolveKernelPath(ck));
    let levelPtr = 0;
    let timsysPtr = 0;
    try {
      levelPtr = writeUtf8CString(module, level);
      timsysPtr = writeUtf8CString(module, timsys);
      const code = module._tspice_ckcov(
        ckPathPtr,
        idcode,
        needav ? 1 : 0,
        levelPtr,
        tol,
        timsysPtr,
        wasmWindowPointer(module, cover, "ckcov()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
    } finally {
      if (timsysPtr) module._free(timsysPtr);
      if (levelPtr) module._free(levelPtr);
      module._free(ckPathPtr);
    }
  });
}

function tspiceCallPxform(
  module: EmscriptenModule,
  from: string,
  to: string,
  et: number,
): Mat3RowMajor {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const fromPtr = writeUtf8CString(module, from);
  let toPtr = 0;
  try {
    toPtr = writeUtf8CString(module, to);
    return withAllocs(module, [errMaxBytes, 9 * 8], (errPtr, outPtr) => {
      const result = module._tspice_pxform(
        fromPtr,
        toPtr,
        et,
        outPtr,
        errPtr,
        errMaxBytes,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }
      const out = Array.from(
        module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 9),
      );
      return brandMat3RowMajor(out, { label: "pxform()" });
    });
  } finally {
    if (toPtr) module._free(toPtr);
    module._free(fromPtr);
  }
}

function tspiceCallSxform(
  module: EmscriptenModule,
  from: string,
  to: string,
  et: number,
): SpiceMatrix6x6 {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const fromPtr = writeUtf8CString(module, from);
  let toPtr = 0;
  try {
    toPtr = writeUtf8CString(module, to);
    return withAllocs(module, [errMaxBytes, 36 * 8], (errPtr, outPtr) => {
      const result = module._tspice_sxform(
        fromPtr,
        toPtr,
        et,
        outPtr,
        errPtr,
        errMaxBytes,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }
      const out = Array.from(
        module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 36),
      );
      return copyStateMatrix(out);
    });
  } finally {
    if (toPtr) module._free(toPtr);
    module._free(fromPtr);
  }
}

function assertFrameString(value: unknown, label: string): void {
  if (typeof value !== "string")
    throw new TypeError(`${label} must be a string`);
}
function assertFrameTransform(
  from: string,
  to: string,
  et: number,
  method: string,
): void {
  assertFrameString(from, `${method}(from)`);
  assertFrameString(to, `${method}(to)`);
  if (!Number.isFinite(et)) throw new TypeError(`${method}(et) must be finite`);
}

function validateCkPointing(
  inst: number,
  sclkdp: number,
  tol: number,
  ref: string,
): void {
  assertSpiceInt32(inst, "CK instrument");
  if (!Number.isFinite(sclkdp) || !Number.isFinite(tol))
    throw new RangeError("CK clock and tolerance must be finite");
  if (typeof ref !== "string")
    throw new TypeError("CK reference must be a string");
}

/** Create a {@link FramesApi} implementation backed by a WASM Emscripten module. */
export function createFramesApi(module: EmscriptenModule): FramesApi {
  return {
    namfrm: (name: string) => {
      assertFrameString(name, "namfrm(name)");
      const out = tspiceCallFoundInt(module, module._tspice_namfrm, name);
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },
    frmnam: (code: number) => {
      assertSpiceInt32(code, "frmnam(code)");
      const out = tspiceCallFoundString(module, module._tspice_frmnam, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },

    cidfrm: (center: number) => {
      assertSpiceInt32(center, "cidfrm(center)");
      return tspiceCallCidfrm(module, module._tspice_cidfrm, center);
    },
    cnmfrm: (centerName: string) => {
      assertFrameString(centerName, "cnmfrm(centerName)");
      return tspiceCallCnmfrm(module, module._tspice_cnmfrm, centerName);
    },
    frinfo: (frameId: number) => {
      assertSpiceInt32(frameId, "frinfo(frameId)");
      return tspiceCallFrinfo(module, frameId);
    },
    ccifrm: (frameClass: number, classId: number) => {
      assertSpiceInt32(frameClass, "ccifrm(frameClass)");
      assertSpiceInt32(classId, "ccifrm(classId)");
      return tspiceCallCcifrm(module, frameClass, classId);
    },

    ckgp: (inst: number, sclkdp: number, tol: number, ref: string) => {
      validateCkPointing(inst, sclkdp, tol, ref);
      return tspiceCallCkgp(module, inst, sclkdp, tol, ref);
    },
    ckgpav: (inst: number, sclkdp: number, tol: number, ref: string) => {
      validateCkPointing(inst, sclkdp, tol, ref);
      return tspiceCallCkgpav(module, inst, sclkdp, tol, ref);
    },

    cklpf: (ck: string) => tspiceCallCklpf(module, ck),
    ckupf: (handle: number) => tspiceCallCkupf(module, handle),
    ckobj: (ck: string, ids: SpiceIntCell) => {
      assertWasmOwnedCellHandle(module, ids, "ckobj(ids)");
      tspiceCallCkobj(module, ck, ids);
    },
    ckcov: (
      ck: string,
      idcode: number,
      needav: boolean,
      level: CkCoverageLevel,
      tol: number,
      timsys: CkCoverageTimeSystem,
      cover: SpiceWindow,
    ) => {
      assertSpiceInt32(idcode, "ckcov(idcode)");
      if (!Number.isFinite(tol))
        throw new RangeError("ckcov tolerance must be finite");
      if (typeof needav !== "boolean")
        throw new TypeError("ckcov needav must be boolean");
      assertWasmOwnedWindowHandle(module, cover, "ckcov(cover)");
      tspiceCallCkcov(module, ck, idcode, needav, level, tol, timsys, cover);
    },

    pxform: (from: string, to: string, et: number) => {
      assertFrameTransform(from, to, et, "pxform");
      return tspiceCallPxform(module, from, to, et);
    },
    sxform: (from: string, to: string, et: number) => {
      assertFrameTransform(from, to, et, "sxform");
      return tspiceCallSxform(module, from, to, et);
    },
  };
}
