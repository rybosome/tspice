import { matrixDimension, matrixElementCount, checkMatrixProductRows, checkMatrixInputLength, assertSpiceStorageFits, copySpiceStorage, spiceStorageLength, assertMat3ArrayLike9, assertSpiceInt32, brandMat3RowMajor, brandMat3RowMajorResult } from "@rybosome/tspice-core";
import type {
  CoordsVectorsApi,
  Mat3RowMajor,
  SpiceVector3,
  SpiceStateVector,
} from "@rybosome/tspice-backend-contract";


import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, WASM_MAX_ALLOC_BYTES } from "../codec/alloc.js";












import { throwWasmSpiceError } from "../codec/errors.js";

const ERR_MAX_BYTES = 2048;

function mallocChecked(
  module: EmscriptenModule,
  bytes: number,
  allocated: number[],
): number {
  const ptr = module._malloc(bytes);
  if (!ptr) {
    // Ensure we don't leak anything that was already allocated.
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
    // Defensively clear so callers can't accidentally double-free if they
    // recover from this error and keep using the same allocation list.
    allocated.length = 0;
    throw new Error("WASM malloc failed");
  }
  allocated.push(ptr);
  return ptr;
}

function mallocF64(
  module: EmscriptenModule,
  count: number,
  allocated: number[],
): number {
  return mallocChecked(module, count * 8, allocated);
}

function writeVec3(
  module: EmscriptenModule,
  ptr: number,
  v: SpiceVector3,
): void {
  module.HEAPF64.set(v, ptr >> 3);
}

function readVec3(module: EmscriptenModule, ptr: number): SpiceVector3 {
  const i = ptr >> 3;
  const h = module.HEAPF64;
  return [h[i] ?? 0, h[i + 1] ?? 0, h[i + 2] ?? 0] as unknown as SpiceVector3;
}

function writeMat3(
  module: EmscriptenModule,
  ptr: number,
  m: Mat3RowMajor,
): void {
  assertMat3ArrayLike9(m);
  module.HEAPF64.set(m, ptr >> 3);
}

function readMat3(
  module: EmscriptenModule,
  ptr: number,
  label: string,
): Mat3RowMajor {
  const i = ptr >> 3;
  const h = module.HEAPF64;
  return brandMat3RowMajor(
    [
      h[i] ?? 0,
      h[i + 1] ?? 0,
      h[i + 2] ?? 0,
      h[i + 3] ?? 0,
      h[i + 4] ?? 0,
      h[i + 5] ?? 0,
      h[i + 6] ?? 0,
      h[i + 7] ?? 0,
      h[i + 8] ?? 0,
    ],
    { label },
  );
}

function tspiceCallReclat(
  module: EmscriptenModule,
  rect: SpiceVector3,
): { radius: number; lon: number; lat: number } {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const rectPtr = mallocF64(module, 3, allocated);
  const outRadiusPtr = mallocF64(module, 1, allocated);
  const outLonPtr = mallocF64(module, 1, allocated);
  const outLatPtr = mallocF64(module, 1, allocated);

  try {
    writeVec3(module, rectPtr, rect);
    module.HEAPF64[outRadiusPtr >> 3] = 0;
    module.HEAPF64[outLonPtr >> 3] = 0;
    module.HEAPF64[outLatPtr >> 3] = 0;

    const result = module._tspice_reclat(
      rectPtr,
      outRadiusPtr,
      outLonPtr,
      outLatPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return {
      radius: module.HEAPF64[outRadiusPtr >> 3] ?? 0,
      lon: module.HEAPF64[outLonPtr >> 3] ?? 0,
      lat: module.HEAPF64[outLatPtr >> 3] ?? 0,
    };
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallLatrec(
  module: EmscriptenModule,
  radius: number,
  lon: number,
  lat: number,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const outRectPtr = mallocF64(module, 3, allocated);

  try {
    module.HEAPF64.set([0, 0, 0], outRectPtr >> 3);

    const result = module._tspice_latrec(
      radius,
      lon,
      lat,
      outRectPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outRectPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallRecsph(
  module: EmscriptenModule,
  rect: SpiceVector3,
): { radius: number; colat: number; lon: number } {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const rectPtr = mallocF64(module, 3, allocated);
  const outRadiusPtr = mallocF64(module, 1, allocated);
  const outColatPtr = mallocF64(module, 1, allocated);
  const outLonPtr = mallocF64(module, 1, allocated);

  try {
    writeVec3(module, rectPtr, rect);
    module.HEAPF64[outRadiusPtr >> 3] = 0;
    module.HEAPF64[outColatPtr >> 3] = 0;
    module.HEAPF64[outLonPtr >> 3] = 0;

    const result = module._tspice_recsph(
      rectPtr,
      outRadiusPtr,
      outColatPtr,
      outLonPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return {
      radius: module.HEAPF64[outRadiusPtr >> 3] ?? 0,
      colat: module.HEAPF64[outColatPtr >> 3] ?? 0,
      lon: module.HEAPF64[outLonPtr >> 3] ?? 0,
    };
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallSphrec(
  module: EmscriptenModule,
  radius: number,
  colat: number,
  lon: number,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const outRectPtr = mallocF64(module, 3, allocated);

  try {
    module.HEAPF64.set([0, 0, 0], outRectPtr >> 3);

    const result = module._tspice_sphrec(
      radius,
      colat,
      lon,
      outRectPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outRectPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVnorm(module: EmscriptenModule, v: SpiceVector3): number {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outNormPtr = mallocF64(module, 1, allocated);

  try {
    writeVec3(module, vPtr, v);
    module.HEAPF64[outNormPtr >> 3] = 0;

    const result = module._tspice_vnorm(
      vPtr,
      outNormPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return module.HEAPF64[outNormPtr >> 3] ?? 0;
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVhat(
  module: EmscriptenModule,
  v: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, vPtr, v);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vhat(vPtr, outPtr, errPtr, ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVdot(
  module: EmscriptenModule,
  a: SpiceVector3,
  b: SpiceVector3,
): number {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const aPtr = mallocF64(module, 3, allocated);
  const bPtr = mallocF64(module, 3, allocated);
  const outDotPtr = mallocF64(module, 1, allocated);

  try {
    writeVec3(module, aPtr, a);
    writeVec3(module, bPtr, b);
    module.HEAPF64[outDotPtr >> 3] = 0;

    const result = module._tspice_vdot(
      aPtr,
      bPtr,
      outDotPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return module.HEAPF64[outDotPtr >> 3] ?? 0;
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVcrss(
  module: EmscriptenModule,
  a: SpiceVector3,
  b: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const aPtr = mallocF64(module, 3, allocated);
  const bPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, aPtr, a);
    writeVec3(module, bPtr, b);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vcrss(
      aPtr,
      bPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallMxv(
  module: EmscriptenModule,
  m: Mat3RowMajor,
  v: SpiceVector3,
): SpiceVector3 {
  assertMat3ArrayLike9(m, { label: "mxv().m" });
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const mPtr = mallocF64(module, 9, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeMat3(module, mPtr, m);
    writeVec3(module, vPtr, v);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_mxv(
      mPtr,
      vPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallMtxv(
  module: EmscriptenModule,
  m: Mat3RowMajor,
  v: SpiceVector3,
): SpiceVector3 {
  assertMat3ArrayLike9(m, { label: "mtxv().m" });
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const mPtr = mallocF64(module, 9, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeMat3(module, mPtr, m);
    writeVec3(module, vPtr, v);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_mtxv(
      mPtr,
      vPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallMxm(
  module: EmscriptenModule,
  a: Mat3RowMajor,
  b: Mat3RowMajor,
): Mat3RowMajor {
  assertMat3ArrayLike9(a, { label: "mxm().a" });
  assertMat3ArrayLike9(b, { label: "mxm().b" });

  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const aPtr = mallocF64(module, 9, allocated);
  const bPtr = mallocF64(module, 9, allocated);
  const outPtr = mallocF64(module, 9, allocated);

  try {
    writeMat3(module, aPtr, a);
    writeMat3(module, bPtr, b);

    const result = module._tspice_mxm(
      aPtr,
      bPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readMat3(module, outPtr, "mxm()");
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVadd(
  module: EmscriptenModule,
  a: SpiceVector3,
  b: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const aPtr = mallocF64(module, 3, allocated);
  const bPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, aPtr, a);
    writeVec3(module, bPtr, b);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vadd(
      aPtr,
      bPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVsub(
  module: EmscriptenModule,
  a: SpiceVector3,
  b: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const aPtr = mallocF64(module, 3, allocated);
  const bPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, aPtr, a);
    writeVec3(module, bPtr, b);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vsub(
      aPtr,
      bPtr,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVminus(
  module: EmscriptenModule,
  v: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, vPtr, v);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vminus(vPtr, outPtr, errPtr, ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallVscl(
  module: EmscriptenModule,
  s: number,
  v: SpiceVector3,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const vPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    writeVec3(module, vPtr, v);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_vscl(s, vPtr, outPtr, errPtr, ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallRotate(
  module: EmscriptenModule,
  angle: number,
  axis: number,
): Mat3RowMajor {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const outPtr = mallocF64(module, 9, allocated);

  try {
    const result = module._tspice_rotate(
      angle,
      axis,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readMat3(module, outPtr, "rotate()");
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallRotmat(
  module: EmscriptenModule,
  m: Mat3RowMajor,
  angle: number,
  axis: number,
): Mat3RowMajor {
  assertMat3ArrayLike9(m, { label: "rotmat().m" });

  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const mPtr = mallocF64(module, 9, allocated);
  const outPtr = mallocF64(module, 9, allocated);

  try {
    writeMat3(module, mPtr, m);

    const result = module._tspice_rotmat(
      mPtr,
      angle,
      axis,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readMat3(module, outPtr, "rotmat()");
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallAxisar(
  module: EmscriptenModule,
  axis: SpiceVector3,
  angle: number,
): Mat3RowMajor {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const axisPtr = mallocF64(module, 3, allocated);
  const outPtr = mallocF64(module, 9, allocated);

  try {
    writeVec3(module, axisPtr, axis);

    const result = module._tspice_axisar(
      axisPtr,
      angle,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readMat3(module, outPtr, "axisar()");
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallGeorec(
  module: EmscriptenModule,
  lon: number,
  lat: number,
  alt: number,
  re: number,
  f: number,
): SpiceVector3 {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const outPtr = mallocF64(module, 3, allocated);

  try {
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);

    const result = module._tspice_georec(
      lon,
      lat,
      alt,
      re,
      f,
      outPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return readVec3(module, outPtr);
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function tspiceCallRecgeo(
  module: EmscriptenModule,
  rect: SpiceVector3,
  re: number,
  f: number,
): { lon: number; lat: number; alt: number } {
  const allocated: number[] = [];
  const errPtr = mallocChecked(module, ERR_MAX_BYTES, allocated);
  const rectPtr = mallocF64(module, 3, allocated);
  const outLonPtr = mallocF64(module, 1, allocated);
  const outLatPtr = mallocF64(module, 1, allocated);
  const outAltPtr = mallocF64(module, 1, allocated);

  try {
    writeVec3(module, rectPtr, rect);
    module.HEAPF64[outLonPtr >> 3] = 0;
    module.HEAPF64[outLatPtr >> 3] = 0;
    module.HEAPF64[outAltPtr >> 3] = 0;

    const result = module._tspice_recgeo(
      rectPtr,
      re,
      f,
      outLonPtr,
      outLatPtr,
      outAltPtr,
      errPtr,
      ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, result);
    }

    return {
      lon: module.HEAPF64[outLonPtr >> 3] ?? 0,
      lat: module.HEAPF64[outLatPtr >> 3] ?? 0,
      alt: module.HEAPF64[outAltPtr >> 3] ?? 0,
    };
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) {
      module._free(allocated[i]!);
    }
  }
}

function assertCoordinateNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
}

function copyCoordinateVector(value: unknown): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(
      "reccyl(rect) must contain exactly three finite numbers",
    );
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`reccyl(rect[${i}]) must be a finite number`);
    return entry;
  };
  return [component(0), component(1), component(2)];
}

function readCoordinateTriple(
  module: EmscriptenModule,
  ptr: number,
): SpiceVector3 {
  const i = ptr >> 3;
  const h = module.HEAPF64;
  return [h[i]!, h[i + 1]!, h[i + 2]!];
}

function callCoordinateTriple(
  module: EmscriptenModule,
  invoke: (outPtr: number, errPtr: number) => number,
): SpiceVector3 {
  return withAllocs(module, [ERR_MAX_BYTES, 24], (errPtr, outPtr) => {
    const status = invoke(outPtr, errPtr);
    if (status !== 0)
      throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
    return readCoordinateTriple(module, outPtr);
  });
}

function assertBasicScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyBasicVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertBasicScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2)];
}

function readBasicVector(module: EmscriptenModule, ptr: number): SpiceVector3 {
  const i = ptr >> 3;
  const h = module.HEAPF64;
  return [h[i]!, h[i + 1]!, h[i + 2]!];
}

function assertCombinationScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyCombinationVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertCombinationScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2)];
}

function copyMatrixInput(value: unknown, label: string): number[] {
  // As with the structural Mat3 contract, accept numeric TypedArrays as well
  // as ordinary arrays. Read by index only; a caller iterator is not trusted.
  if (
    !(
      Array.isArray(value) ||
      value instanceof Float64Array ||
      value instanceof Float32Array ||
      value instanceof Int8Array ||
      value instanceof Uint8Array ||
      value instanceof Uint8ClampedArray ||
      value instanceof Int16Array ||
      value instanceof Uint16Array ||
      value instanceof Int32Array ||
      value instanceof Uint32Array
    ) ||
    value.length !== 9
  ) {
    throw new TypeError(`${label} must contain exactly nine finite numbers`);
  }
  const copy: number[] = [];
  for (let i = 0; i < 9; i++) {
    const component: unknown = value[i];
    assertCombinationScalar(component, `${label}[${i}]`);
    copy.push(component);
  }
  return copy;
}

function readCombinationVector(
  module: EmscriptenModule,
  ptr: number,
): SpiceVector3 {
  const i = ptr >> 3;
  const heap = module.HEAPF64;
  return [heap[i]!, heap[i + 1]!, heap[i + 2]!];
}

function assertConventionScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyConventionVector(value: unknown, label: string): SpiceVector3 {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError(`${label} must contain exactly three finite numbers`);
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`${label}[${i}] must be a finite number`);
    return entry;
  };
  return [component(0), component(1), component(2)];
}

function assertConventionBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${label} must be a boolean`);
}

function assertConventionBody(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError(`${label} must be a string without embedded NUL`);
}

function readConventionVector(
  module: EmscriptenModule,
  ptr: number,
): SpiceVector3 {
  const i = ptr >> 3;
  const heap = module.HEAPF64;
  return [heap[i]!, heap[i + 1]!, heap[i + 2]!];
}

function assertScalarMathDouble(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function assertScalarMathString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError(`${label} must be a string without embedded NUL`);
}

function copyScalarMathArray(
  value: unknown,
  label: string,
  integers: boolean,
  maxCount: number,
): number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const count = value.length;
  if (!Number.isSafeInteger(count) || count < 0 || count > maxCount)
    throw new RangeError(`${label} must contain at most ${maxCount} values`);
  scalarMathBufferBytes(count, integers ? 4 : 8);
  const copy: number[] = [];
  for (let i = 0; i < count; i++) {
    const entry: unknown = value[i];
    assertScalarMathDouble(entry, `${label}[${i}]`);
    if (integers) assertSpiceInt32(entry, `${label}[${i}]`);
    copy.push(entry);
  }
  return copy;
}

function assertSumaiPrefixes(values: readonly number[]): void {
  // Validation only: the returned sum must still come from actual sumai_c.
  // Each addition is exact here because the previous prefix and next input
  // are both signed32, so their sum fits exactly in a JavaScript number.
  let prefix = 0;
  for (const value of values) {
    prefix += value;
    if (prefix < -2147483648 || prefix > 2147483647)
      throw new RangeError(
        "sumai(values) prefix sums must fit signed 32-bit integers",
      );
  }
}

function scalarMathBufferBytes(count: number, width: number): number {
  // Check byte counts before allocating anything; no bitwise size conversion.
  const bytes = Math.max(1, count) * width;
  if (!Number.isSafeInteger(bytes) || bytes > WASM_MAX_ALLOC_BYTES)
    throw new RangeError(
      `Scalar math input buffer exceeds ${WASM_MAX_ALLOC_BYTES} bytes`,
    );
  return bytes;
}

function copyStateDerivativeInput(
  value: unknown,
  label: string,
): SpiceStateVector {
  if (!Array.isArray(value) || value.length !== 6)
    throw new TypeError(`${label} must contain exactly six finite numbers`);
  // Validate the exact values passed to the backend, even for accessor arrays.
  const component = (i: number): number => {
    const entry: unknown = value[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError(`${label}[${i}] must be a finite number`);
    return entry;
  };
  return [
    component(0),
    component(1),
    component(2),
    component(3),
    component(4),
    component(5),
  ];
}

function readStateDerivativeOutput(
  module: EmscriptenModule,
  ptr: number,
): SpiceStateVector {
  const start = ptr >>> 3;
  const heap = module.HEAPF64;
  return [
    heap[start]!,
    heap[start + 1]!,
    heap[start + 2]!,
    heap[start + 3]!,
    heap[start + 4]!,
    heap[start + 5]!,
  ];
}

function assertPolynomialNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyPolynomialCoefficients(
  value: unknown,
  label: string,
  allowEmpty: boolean,
): number[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 2147483647 ||
    (!allowEmpty && length === 0)
  )
    throw new RangeError(`${label} has an unsupported coefficient count`);
  polynomialBufferBytes(length);
  // Coefficient getters must not be re-read during native/WASM marshaling.
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry: unknown = value[i];
    assertPolynomialNumber(entry, `${label}[${i}]`);
    result.push(entry);
  }
  return result;
}

function copyPolynomialTransform(
  value: unknown,
  label: string,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`${label} must be a length-2 array`);
  const midpoint: unknown = value[0];
  const scale: unknown = value[1];
  assertPolynomialNumber(midpoint, `${label}[0]`);
  assertPolynomialNumber(scale, `${label}[1]`);
  return [midpoint, scale];
}

function polynomialDerivativeCount(nderiv: number, chebyshev: boolean): number {
  assertSpiceInt32(nderiv, "nderiv");
  if (
    (chebyshev && (nderiv < 0 || nderiv > 715827881)) ||
    (!chebyshev && nderiv > 2147483646)
  )
    throw new RangeError("nderiv exceeds the supported derivative order");
  return nderiv < 0 ? 0 : nderiv + 1;
}

function polynomialBufferBytes(count: number): number {
  const bytes = Math.max(1, count) * 8;
  if (!Number.isSafeInteger(bytes) || bytes > WASM_MAX_ALLOC_BYTES)
    throw new RangeError(
      `Polynomial buffer exceeds ${WASM_MAX_ALLOC_BYTES} bytes`,
    );
  return bytes;
}

function readPolynomialArray(
  module: EmscriptenModule,
  ptr: number,
  count: number,
): number[] {
  const start = ptr >>> 3;
  return Array.from(module.HEAPF64.subarray(start, start + count));
}

function readPolynomialPair(
  module: EmscriptenModule,
  ptr: number,
): [number, number] {
  const start = ptr >>> 3;
  return [module.HEAPF64[start]!, module.HEAPF64[start + 1]!];
}

function assertInterpolationNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function interpolationCount(
  value: unknown,
  stride: number,
  maximum: number,
  label: string,
): number {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length % stride !== 0 ||
    length / stride > maximum
  )
    throw new RangeError(`${label} has an unsupported point count or layout`);
  return length / stride;
}

function copyInterpolationValues(
  value: readonly number[],
  length: number,
  label: string,
): number[] {
  // Read exactly the validated count. An input accessor can mutate another
  // array while inputs are being copied; a missing entry must fail validation.
  const copy: number[] = [];
  for (let i = 0; i < length; i++) {
    const entry = value[i];
    assertInterpolationNumber(entry, `${label}[${i}]`);
    copy.push(entry);
  }
  return copy;
}

function interpolationBufferBytes(count: number): number {
  const bytes = Math.max(1, count) * 8;
  if (!Number.isSafeInteger(bytes) || bytes > WASM_MAX_ALLOC_BYTES)
    throw new RangeError(
      `Interpolation buffer exceeds ${WASM_MAX_ALLOC_BYTES} bytes`,
    );
  return bytes;
}

function readInterpolationArray(
  module: EmscriptenModule,
  ptr: number,
  count: number,
): number[] {
  const start = ptr >>> 3;
  return Array.from(module.HEAPF64.subarray(start, start + count));
}

function jacobianBody(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new TypeError("Expected a UTF-8 representable NUL-free body name");
  return value;
}

function jacobianFlag(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new TypeError("Expected a boolean direction flag");
  return value;
}

function assertFixedMatrixScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function copyFixedMatrix2(value: unknown): [number, number, number, number] {
  const label = "diags2(symmat)";
  if (!Array.isArray(value) || value.length !== 4)
    throw new TypeError(`${label} must contain exactly four finite numbers`);
  // The exact entries validated here are also the ones passed to the backend.
  const entry = (i: number): number => {
    const component: unknown = value[i];
    assertFixedMatrixScalar(component, `${label}[${i}]`);
    return component;
  };
  return [entry(0), entry(1), entry(2), entry(3)];
}

function readFixedMatrixResult(
  module: EmscriptenModule,
  ptr: number,
  label: string,
): Mat3RowMajor {
  const start = (ptr >>> 0) / 8;
  return brandMat3RowMajorResult(module.HEAPF64.subarray(start, start + 9), {
    label,
  });
}

function readFixedMatrix2(
  module: EmscriptenModule,
  ptr: number,
): [number, number, number, number] {
  const i = ptr >> 3;
  const heap = module.HEAPF64;
  return [heap[i]!, heap[i + 1]!, heap[i + 2]!, heap[i + 3]!];
}

function rotationQuaternion(
  value: unknown,
  label: string,
  requireFinite: boolean,
): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4)
    throw new TypeError(label + " must contain four quaternion components");
  const entry = (i: number) => {
    const x: unknown = value[i];
    if (typeof x !== "number" || (requireFinite && !Number.isFinite(x)))
      throw new TypeError(label + " contains an invalid component");
    return x;
  };
  return [entry(0), entry(1), entry(2), entry(3)];
}

function assertGeneralVectorScalar(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number`);
}

function generalVectorDimension(
  value: unknown,
  label: string,
  maximum: number,
): number {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum)
    throw new RangeError(`${label} exceeds maximum dimension ${maximum}`);
  generalVectorBufferBytes(length);
  return length;
}

function copyGeneralVector(
  value: readonly number[],
  dimension: number,
  label: string,
): number[] {
  // Read exactly the captured dimension, once per component. Callers' arrays
  // may contain accessors, so marshal this checked copy rather than re-reading.
  const result: number[] = [];
  for (let i = 0; i < dimension; i++) {
    const component = value[i];
    assertGeneralVectorScalar(component, `${label}[${i}]`);
    result.push(component);
  }
  return result;
}

function generalVectorBufferBytes(dimension: number): number {
  const bytes = Math.max(1, dimension) * 8;
  if (!Number.isSafeInteger(bytes) || bytes > WASM_MAX_ALLOC_BYTES)
    throw new RangeError(
      `General vector buffer exceeds ${WASM_MAX_ALLOC_BYTES} bytes`,
    );
  return bytes;
}

function readGeneralVector(
  module: EmscriptenModule,
  ptr: number,
  dimension: number,
): number[] {
  const start = ptr >>> 3;
  return Array.from(module.HEAPF64.subarray(start, start + dimension));
}

/** Create a {@link CoordsVectorsApi} implementation backed by a WASM Emscripten module. */
export function createCoordsVectorsApi(
  module: EmscriptenModule,
): CoordsVectorsApi {
  return {
    pi: () => module._tspice_pi(),
    twopi: () => module._tspice_twopi(),
    halfpi: () => module._tspice_halfpi(),
    dpr: () => module._tspice_dpr(),
    rpd: () => module._tspice_rpd(),
    clight: () => module._tspice_clight(),
    dpmax: () => module._tspice_dpmax(),
    dpmin: () => module._tspice_dpmin(),
    intmax: () => module._tspice_intmax(),
    intmin: () => module._tspice_intmin(),
    cyllat: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cyllat(radius)");
      assertCoordinateNumber(lon, "cyllat(lon)");
      assertCoordinateNumber(z, "cyllat(z)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_cyllat(radius, lon, z, outPtr, errPtr, ERR_MAX_BYTES),
      );
      return { radius: out[0], lon: out[1], lat: out[2] };
    },
    cylrec: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cylrec(radius)");
      assertCoordinateNumber(lon, "cylrec(lon)");
      assertCoordinateNumber(z, "cylrec(z)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_cylrec(radius, lon, z, outPtr, errPtr, ERR_MAX_BYTES),
      );
      return out;
    },
    cylsph: (radius, lon, z) => {
      assertCoordinateNumber(radius, "cylsph(radius)");
      assertCoordinateNumber(lon, "cylsph(lon)");
      assertCoordinateNumber(z, "cylsph(z)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_cylsph(radius, lon, z, outPtr, errPtr, ERR_MAX_BYTES),
      );
      return { radius: out[0], colat: out[1], lon: out[2] };
    },
    latcyl: (radius, lon, lat) => {
      assertCoordinateNumber(radius, "latcyl(radius)");
      assertCoordinateNumber(lon, "latcyl(lon)");
      assertCoordinateNumber(lat, "latcyl(lat)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_latcyl(radius, lon, lat, outPtr, errPtr, ERR_MAX_BYTES),
      );
      return { radius: out[0], lon: out[1], z: out[2] };
    },
    latsph: (radius, lon, lat) => {
      assertCoordinateNumber(radius, "latsph(radius)");
      assertCoordinateNumber(lon, "latsph(lon)");
      assertCoordinateNumber(lat, "latsph(lat)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_latsph(radius, lon, lat, outPtr, errPtr, ERR_MAX_BYTES),
      );
      return { radius: out[0], colat: out[1], lon: out[2] };
    },
    reccyl: (rect) => {
      const rectCopy = copyCoordinateVector(rect);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, rectPtr, outPtr) => {
          module.HEAPF64.set(rectCopy, rectPtr >> 3);
          const status = module._tspice_reccyl(
            rectPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const out = readCoordinateTriple(module, outPtr);
          return { radius: out[0], lon: out[1], z: out[2] };
        },
      );
    },
    sphcyl: (radius, colat, lon) => {
      assertCoordinateNumber(radius, "sphcyl(radius)");
      assertCoordinateNumber(colat, "sphcyl(colat)");
      assertCoordinateNumber(lon, "sphcyl(lon)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_sphcyl(
          radius,
          colat,
          lon,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        ),
      );
      return { radius: out[0], lon: out[1], z: out[2] };
    },
    sphlat: (radius, colat, lon) => {
      assertCoordinateNumber(radius, "sphlat(radius)");
      assertCoordinateNumber(colat, "sphlat(colat)");
      assertCoordinateNumber(lon, "sphlat(lon)");
      const out = callCoordinateTriple(module, (outPtr, errPtr) =>
        module._tspice_sphlat(
          radius,
          colat,
          lon,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        ),
      );
      return { radius: out[0], lon: out[1], lat: out[2] };
    },
    vdist: (a, b) => {
      const aCopy = copyBasicVector(a, "vdist(a)");
      const bCopy = copyBasicVector(b, "vdist(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_vdist(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    vequ: (v) => {
      const vCopy = copyBasicVector(v, "vequ(v)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          const status = module._tspice_vequ(
            vPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readBasicVector(module, outPtr);
        },
      );
    },
    vpack: (x, y, z) => {
      assertBasicScalar(x, "vpack(x)");
      assertBasicScalar(y, "vpack(y)");
      assertBasicScalar(z, "vpack(z)");
      return withAllocs(module, [ERR_MAX_BYTES, 24], (errPtr, outPtr) => {
        const status = module._tspice_vpack(
          x,
          y,
          z,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readBasicVector(module, outPtr);
      });
    },
    vupack: (v) => {
      const vCopy = copyBasicVector(v, "vupack(v)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          const status = module._tspice_vupack(
            vPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const out = readBasicVector(module, outPtr);
          return { x: out[0], y: out[1], z: out[2] };
        },
      );
    },
    vzero: (v) => {
      const vCopy = copyBasicVector(v, "vzero(v)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 4],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          const status = module._tspice_vzero(
            vPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >> 2] !== 0;
        },
      );
    },
    unorm: (v) => {
      const vCopy = copyBasicVector(v, "unorm(v)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 8],
        (errPtr, vPtr, outPtr, normPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          const status = module._tspice_unorm(
            vPtr,
            outPtr,
            normPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            unit: readBasicVector(module, outPtr),
            norm: module.HEAPF64[normPtr >> 3]!,
          };
        },
      );
    },
    ucrss: (a, b) => {
      const aCopy = copyBasicVector(a, "ucrss(a)");
      const bCopy = copyBasicVector(b, "ucrss(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_ucrss(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readBasicVector(module, outPtr);
        },
      );
    },
    vsep: (a, b) => {
      const aCopy = copyBasicVector(a, "vsep(a)");
      const bCopy = copyBasicVector(b, "vsep(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_vsep(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    vlcom: (a, v1, b, v2) => {
      assertCombinationScalar(a, "vlcom(a)");
      const v1Copy = copyCombinationVector(v1, "vlcom(v1)");
      assertCombinationScalar(b, "vlcom(b)");
      const v2Copy = copyCombinationVector(v2, "vlcom(v2)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24],
        (errPtr, v1Ptr, v2Ptr, outPtr) => {
          module.HEAPF64.set(v1Copy, v1Ptr >> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >> 3);
          const status = module._tspice_vlcom(
            a,
            v1Ptr,
            b,
            v2Ptr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    vlcom3: (a, v1, b, v2, c, v3) => {
      assertCombinationScalar(a, "vlcom3(a)");
      const v1Copy = copyCombinationVector(v1, "vlcom3(v1)");
      assertCombinationScalar(b, "vlcom3(b)");
      const v2Copy = copyCombinationVector(v2, "vlcom3(v2)");
      assertCombinationScalar(c, "vlcom3(c)");
      const v3Copy = copyCombinationVector(v3, "vlcom3(v3)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24, 24],
        (errPtr, v1Ptr, v2Ptr, v3Ptr, outPtr) => {
          module.HEAPF64.set(v1Copy, v1Ptr >> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >> 3);
          module.HEAPF64.set(v3Copy, v3Ptr >> 3);
          const status = module._tspice_vlcom3(
            a,
            v1Ptr,
            b,
            v2Ptr,
            c,
            v3Ptr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    vperp: (a, b) => {
      const aCopy = copyCombinationVector(a, "vperp(a)");
      const bCopy = copyCombinationVector(b, "vperp(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_vperp(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    vproj: (a, b) => {
      const aCopy = copyCombinationVector(a, "vproj(a)");
      const bCopy = copyCombinationVector(b, "vproj(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_vproj(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    vrel: (a, b) => {
      const aCopy = copyCombinationVector(a, "vrel(a)");
      const bCopy = copyCombinationVector(b, "vrel(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_vrel(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    vrotv: (v, axis, theta) => {
      const vCopy = copyCombinationVector(v, "vrotv(v)");
      const axisCopy = copyCombinationVector(axis, "vrotv(axis)");
      assertCombinationScalar(theta, "vrotv(theta)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24, 24],
        (errPtr, vPtr, axisPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          module.HEAPF64.set(axisCopy, axisPtr >> 3);
          const status = module._tspice_vrotv(
            vPtr,
            axisPtr,
            theta,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    rotvec: (v, angle, axis) => {
      const vCopy = copyCombinationVector(v, "rotvec(v)");
      assertCombinationScalar(angle, "rotvec(angle)");
      assertSpiceInt32(axis, "rotvec(axis)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >> 3);
          const status = module._tspice_rotvec(
            vPtr,
            angle,
            axis,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readCombinationVector(module, outPtr);
        },
      );
    },
    vtmv: (v1, matrix, v2) => {
      const v1Copy = copyCombinationVector(v1, "vtmv(v1)");
      const matrixCopy = copyMatrixInput(matrix, "vtmv(matrix)");
      const v2Copy = copyCombinationVector(v2, "vtmv(v2)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 72, 24, 8],
        (errPtr, v1Ptr, matrixPtr, v2Ptr, outPtr) => {
          module.HEAPF64.set(v1Copy, v1Ptr >> 3);
          module.HEAPF64.set(matrixCopy, matrixPtr >> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >> 3);
          const status = module._tspice_vtmv(
            v1Ptr,
            matrixPtr,
            v2Ptr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    azlrec: (range, az, el, azccw, elplsz) => {
      assertConventionScalar(range, "azlrec(range)");
      assertConventionScalar(az, "azlrec(az)");
      assertConventionScalar(el, "azlrec(el)");
      assertConventionBoolean(azccw, "azlrec(azccw)");
      assertConventionBoolean(elplsz, "azlrec(elplsz)");
      return withAllocs(module, [ERR_MAX_BYTES, 24], (errPtr, outPtr) => {
        const status = module._tspice_azlrec(
          range,
          az,
          el,
          azccw ? 1 : 0,
          elplsz ? 1 : 0,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readConventionVector(module, outPtr);
      });
    },
    recazl: (rect, azccw, elplsz) => {
      const rectCopy = copyConventionVector(rect, "recazl(rect)");
      assertConventionBoolean(azccw, "recazl(azccw)");
      assertConventionBoolean(elplsz, "recazl(elplsz)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, rectPtr, outPtr) => {
          module.HEAPF64.set(rectCopy, rectPtr >> 3);
          const status = module._tspice_recazl(
            rectPtr,
            azccw ? 1 : 0,
            elplsz ? 1 : 0,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const values = readConventionVector(module, outPtr);
          return { range: values[0], az: values[1], el: values[2] };
        },
      );
    },
    pgrrec: (body, lon, lat, alt, re, f) => {
      assertConventionBody(body, "pgrrec(body)");
      assertConventionScalar(lon, "pgrrec(lon)");
      assertConventionScalar(lat, "pgrrec(lat)");
      assertConventionScalar(alt, "pgrrec(alt)");
      assertConventionScalar(re, "pgrrec(re)");
      assertConventionScalar(f, "pgrrec(f)");
      const bodyBytes = new TextEncoder().encode(body);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bodyBytes.length + 1, 24],
        (errPtr, bodyPtr, outPtr) => {
          module.HEAPU8.set(bodyBytes, bodyPtr);
          module.HEAPU8[bodyPtr + bodyBytes.length] = 0;
          const status = module._tspice_pgrrec(
            bodyPtr,
            lon,
            lat,
            alt,
            re,
            f,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readConventionVector(module, outPtr);
        },
      );
    },
    recpgr: (body, rect, re, f) => {
      assertConventionBody(body, "recpgr(body)");
      const rectCopy = copyConventionVector(rect, "recpgr(rect)");
      assertConventionScalar(re, "recpgr(re)");
      assertConventionScalar(f, "recpgr(f)");
      const bodyBytes = new TextEncoder().encode(body);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bodyBytes.length + 1, 24, 24],
        (errPtr, bodyPtr, rectPtr, outPtr) => {
          module.HEAPU8.set(bodyBytes, bodyPtr);
          module.HEAPU8[bodyPtr + bodyBytes.length] = 0;
          module.HEAPF64.set(rectCopy, rectPtr >> 3);
          const status = module._tspice_recpgr(
            bodyPtr,
            rectPtr,
            re,
            f,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const values = readConventionVector(module, outPtr);
          return { lon: values[0], lat: values[1], alt: values[2] };
        },
      );
    },
    radrec: (range, ra, dec) => {
      assertConventionScalar(range, "radrec(range)");
      assertConventionScalar(ra, "radrec(ra)");
      assertConventionScalar(dec, "radrec(dec)");
      return withAllocs(module, [ERR_MAX_BYTES, 24], (errPtr, outPtr) => {
        const status = module._tspice_radrec(
          range,
          ra,
          dec,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readConventionVector(module, outPtr);
      });
    },
    recrad: (rect) => {
      const rectCopy = copyConventionVector(rect, "recrad(rect)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 24, 24],
        (errPtr, rectPtr, outPtr) => {
          module.HEAPF64.set(rectCopy, rectPtr >> 3);
          const status = module._tspice_recrad(
            rectPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const values = readConventionVector(module, outPtr);
          return { range: values[0], ra: values[1], dec: values[2] };
        },
      );
    },
    srfrec: (body, lon, lat) => {
      assertSpiceInt32(body, "srfrec(body)");
      assertConventionScalar(lon, "srfrec(lon)");
      assertConventionScalar(lat, "srfrec(lat)");
      return withAllocs(module, [ERR_MAX_BYTES, 24], (errPtr, outPtr) => {
        const status = module._tspice_srfrec(
          body,
          lon,
          lat,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readConventionVector(module, outPtr);
      });
    },
    brcktd: (value, end1, end2) => {
      assertScalarMathDouble(value, "brcktd(value)");
      assertScalarMathDouble(end1, "brcktd(end1)");
      assertScalarMathDouble(end2, "brcktd(end2)");
      return withAllocs(module, [ERR_MAX_BYTES, 8], (errPtr, outPtr) => {
        const status = module._tspice_brcktd(
          value,
          end1,
          end2,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return module.HEAPF64[outPtr >>> 3]!;
      });
    },
    brckti: (value, end1, end2) => {
      assertSpiceInt32(value, "brckti(value)");
      assertSpiceInt32(end1, "brckti(end1)");
      assertSpiceInt32(end2, "brckti(end2)");
      return withAllocs(module, [ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_brckti(
          value,
          end1,
          end2,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return module.HEAP32[outPtr >>> 2]!;
      });
    },
    convrt: (value, inUnit, outUnit) => {
      assertScalarMathDouble(value, "convrt(value)");
      assertScalarMathString(inUnit, "convrt(inUnit)");
      assertScalarMathString(outUnit, "convrt(outUnit)");
      const inUnitBytes = new TextEncoder().encode(inUnit);
      const inUnitSize = scalarMathBufferBytes(inUnitBytes.length + 1, 1);
      const outUnitBytes = new TextEncoder().encode(outUnit);
      const outUnitSize = scalarMathBufferBytes(outUnitBytes.length + 1, 1);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, inUnitSize, outUnitSize, 8],
        (errPtr, inUnitPtr, outUnitPtr, outPtr) => {
          module.HEAPU8.set(inUnitBytes, inUnitPtr);
          module.HEAPU8[inUnitPtr + inUnitBytes.length] = 0;
          module.HEAPU8.set(outUnitBytes, outUnitPtr);
          module.HEAPU8[outUnitPtr + outUnitBytes.length] = 0;
          const status = module._tspice_convrt(
            value,
            inUnitPtr,
            outUnitPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    sumad: (values) => {
      const valuesCopy = copyScalarMathArray(
        values,
        "sumad(values)",
        false,
        2147483647,
      );
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 8);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 8],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAPF64.set(valuesCopy, valuesPtr >>> 3);
          const status = module._tspice_sumad(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    sumai: (values) => {
      const valuesCopy = copyScalarMathArray(
        values,
        "sumai(values)",
        true,
        2147483647,
      );
      assertSumaiPrefixes(valuesCopy);
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 4);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 4],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAP32.set(valuesCopy, valuesPtr >>> 2);
          const status = module._tspice_sumai(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2]!;
        },
      );
    },
    maxd: (values) => {
      const valuesCopy = copyScalarMathArray(values, "maxd(values)", false, 30);
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 8);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 8],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAPF64.set(valuesCopy, valuesPtr >>> 3);
          const status = module._tspice_maxd(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    maxi: (values) => {
      const valuesCopy = copyScalarMathArray(values, "maxi(values)", true, 30);
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 4);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 4],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAP32.set(valuesCopy, valuesPtr >>> 2);
          const status = module._tspice_maxi(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2]!;
        },
      );
    },
    mind: (values) => {
      const valuesCopy = copyScalarMathArray(values, "mind(values)", false, 30);
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 8);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 8],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAPF64.set(valuesCopy, valuesPtr >>> 3);
          const status = module._tspice_mind(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    mini: (values) => {
      const valuesCopy = copyScalarMathArray(values, "mini(values)", true, 30);
      const valuesBytes = scalarMathBufferBytes(valuesCopy.length, 4);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, valuesBytes, 4],
        (errPtr, valuesPtr, outPtr) => {
          module.HEAP32.set(valuesCopy, valuesPtr >>> 2);
          const status = module._tspice_mini(
            valuesPtr,
            valuesCopy.length,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2]!;
        },
      );
    },
    ducrss: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "ducrss(a)");
      const bCopy = copyStateDerivativeInput(b, "ducrss(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 48, 48],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_ducrss(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readStateDerivativeOutput(module, outPtr);
        },
      );
    },
    dvcrss: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvcrss(a)");
      const bCopy = copyStateDerivativeInput(b, "dvcrss(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 48, 48],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_dvcrss(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readStateDerivativeOutput(module, outPtr);
        },
      );
    },
    dvdot: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvdot(a)");
      const bCopy = copyStateDerivativeInput(b, "dvdot(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 48, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_dvdot(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    dvhat: (state) => {
      const stateCopy = copyStateDerivativeInput(state, "dvhat(state)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 48],
        (errPtr, statePtr, outPtr) => {
          module.HEAPF64.set(stateCopy, statePtr >>> 3);
          const status = module._tspice_dvhat(
            statePtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readStateDerivativeOutput(module, outPtr);
        },
      );
    },
    dvnorm: (state) => {
      const stateCopy = copyStateDerivativeInput(state, "dvnorm(state)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 8],
        (errPtr, statePtr, outPtr) => {
          module.HEAPF64.set(stateCopy, statePtr >>> 3);
          const status = module._tspice_dvnorm(
            statePtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    dvsep: (a, b) => {
      const aCopy = copyStateDerivativeInput(a, "dvsep(a)");
      const bCopy = copyStateDerivativeInput(b, "dvsep(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 48, 48, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_dvsep(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    chbder: (cp, x2s, x, nderiv) => {
      const outputCount = polynomialDerivativeCount(nderiv, true);
      const outputBytes = polynomialBufferBytes(outputCount);
      const workspaceBytes = polynomialBufferBytes(3 * outputCount);
      const cpCopy = copyPolynomialCoefficients(cp, "chbder(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbder(x2s)");
      assertPolynomialNumber(x, "chbder(x)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          polynomialBufferBytes(cpCopy.length),
          16,
          workspaceBytes,
          outputBytes,
        ],
        (errPtr, cpPtr, x2sPtr, workspacePtr, outPtr) => {
          module.HEAPF64.set(cpCopy, cpPtr >>> 3);
          module.HEAPF64.set(transform, x2sPtr >>> 3);
          const status = module._tspice_chbder(
            cpPtr,
            cpCopy.length,
            x2sPtr,
            x,
            nderiv,
            workspacePtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readPolynomialArray(module, outPtr, outputCount);
        },
      );
    },
    chbigr: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbigr(cp)", true);
      const transform = copyPolynomialTransform(x2s, "chbigr(x2s)");
      assertPolynomialNumber(x, "chbigr(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, polynomialBufferBytes(cpCopy.length), 16, 8, 8],
        (errPtr, cpPtr, x2sPtr, outPtr, secondaryPtr) => {
          module.HEAPF64.set(cpCopy, cpPtr >>> 3);
          module.HEAPF64.set(transform, x2sPtr >>> 3);
          const status = module._tspice_chbigr(
            cpPtr,
            cpCopy.length,
            x2sPtr,
            x,
            outPtr,
            secondaryPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            p: module.HEAPF64[outPtr >>> 3]!,
            itgrlp: module.HEAPF64[secondaryPtr >>> 3]!,
          };
        },
      );
    },
    chbint: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbint(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbint(x2s)");
      assertPolynomialNumber(x, "chbint(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, polynomialBufferBytes(cpCopy.length), 16, 8, 8],
        (errPtr, cpPtr, x2sPtr, outPtr, secondaryPtr) => {
          module.HEAPF64.set(cpCopy, cpPtr >>> 3);
          module.HEAPF64.set(transform, x2sPtr >>> 3);
          const status = module._tspice_chbint(
            cpPtr,
            cpCopy.length,
            x2sPtr,
            x,
            outPtr,
            secondaryPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            p: module.HEAPF64[outPtr >>> 3]!,
            dpdx: module.HEAPF64[secondaryPtr >>> 3]!,
          };
        },
      );
    },
    chbval: (cp, x2s, x) => {
      const cpCopy = copyPolynomialCoefficients(cp, "chbval(cp)", false);
      const transform = copyPolynomialTransform(x2s, "chbval(x2s)");
      assertPolynomialNumber(x, "chbval(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, polynomialBufferBytes(cpCopy.length), 16, 8],
        (errPtr, cpPtr, x2sPtr, outPtr) => {
          module.HEAPF64.set(cpCopy, cpPtr >>> 3);
          module.HEAPF64.set(transform, x2sPtr >>> 3);
          const status = module._tspice_chbval(
            cpPtr,
            cpCopy.length,
            x2sPtr,
            x,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    polyds: (coeffs, nderiv, t) => {
      const outputCount = polynomialDerivativeCount(nderiv, false);
      const outputBytes = polynomialBufferBytes(outputCount);
      const coeffsCopy = copyPolynomialCoefficients(
        coeffs,
        "polyds(coeffs)",
        true,
      );
      assertPolynomialNumber(t, "polyds(t)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, polynomialBufferBytes(coeffsCopy.length), outputBytes],
        (errPtr, coeffsPtr, outPtr) => {
          module.HEAPF64.set(coeffsCopy, coeffsPtr >>> 3);
          const status = module._tspice_polyds(
            coeffsPtr,
            coeffsCopy.length,
            nderiv,
            t,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readPolynomialArray(module, outPtr, outputCount);
        },
      );
    },
    rquad: (a, b, c) => {
      assertPolynomialNumber(a, "rquad(a)");
      assertPolynomialNumber(b, "rquad(b)");
      assertPolynomialNumber(c, "rquad(c)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 16, 16],
        (errPtr, root1Ptr, root2Ptr) => {
          const status = module._tspice_rquad(
            a,
            b,
            c,
            root1Ptr,
            root2Ptr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            root1: readPolynomialPair(module, root1Ptr),
            root2: readPolynomialPair(module, root2Ptr),
          };
        },
      );
    },
    hrmesp: (first, step, yvals, x) => {
      const count = interpolationCount(yvals, 2, 67108863, "hrmesp(yvals)");
      interpolationBufferBytes(4 * count);
      const yvalsBytes = interpolationBufferBytes(2 * count);
      assertInterpolationNumber(first, "hrmesp(first)");
      assertInterpolationNumber(step, "hrmesp(step)");
      const yvalsCopy = copyInterpolationValues(
        yvals,
        2 * count,
        "hrmesp(yvals)",
      );
      assertInterpolationNumber(x, "hrmesp(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, yvalsBytes, 8, 8],
        (errPtr, yvalsPtr, outPtr, derivativePtr) => {
          module.HEAPF64.set(yvalsCopy, yvalsPtr >>> 3);
          const status = module._tspice_hrmesp(
            count,
            first,
            step,
            yvalsPtr,
            x,
            outPtr,
            derivativePtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            f: module.HEAPF64[outPtr >>> 3]!,
            df: module.HEAPF64[derivativePtr >>> 3]!,
          };
        },
      );
    },
    hrmint: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 357913941, "hrmint(xvals)");
      const otherCount = interpolationCount(
        yvals,
        2,
        357913941,
        "hrmint(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("hrmint() input array lengths do not match");
      interpolationBufferBytes(4 * count);
      const xvalsBytes = interpolationBufferBytes(1 * count);
      const yvalsBytes = interpolationBufferBytes(2 * count);
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "hrmint(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        2 * count,
        "hrmint(yvals)",
      );
      assertInterpolationNumber(x, "hrmint(x)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          xvalsBytes,
          yvalsBytes,
          interpolationBufferBytes(4 * count),
          8,
          8,
        ],
        (errPtr, xvalsPtr, yvalsPtr, workPtr, outPtr, derivativePtr) => {
          module.HEAPF64.set(xvalsCopy, xvalsPtr >>> 3);
          module.HEAPF64.set(yvalsCopy, yvalsPtr >>> 3);
          const status = module._tspice_hrmint(
            count,
            xvalsPtr,
            yvalsPtr,
            x,
            workPtr,
            outPtr,
            derivativePtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            f: module.HEAPF64[outPtr >>> 3]!,
            df: module.HEAPF64[derivativePtr >>> 3]!,
          };
        },
      );
    },
    lgresp: (first, step, yvals, x) => {
      const count = interpolationCount(yvals, 1, 268435455, "lgresp(yvals)");
      interpolationBufferBytes(1 * count);
      const yvalsBytes = interpolationBufferBytes(1 * count);
      assertInterpolationNumber(first, "lgresp(first)");
      assertInterpolationNumber(step, "lgresp(step)");
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgresp(yvals)",
      );
      assertInterpolationNumber(x, "lgresp(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, yvalsBytes, 8],
        (errPtr, yvalsPtr, outPtr) => {
          module.HEAPF64.set(yvalsCopy, yvalsPtr >>> 3);
          const status = module._tspice_lgresp(
            count,
            first,
            step,
            yvalsPtr,
            x,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    lgrind: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 715827882, "lgrind(xvals)");
      const otherCount = interpolationCount(
        yvals,
        1,
        715827882,
        "lgrind(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("lgrind() input array lengths do not match");
      interpolationBufferBytes(2 * count);
      const xvalsBytes = interpolationBufferBytes(1 * count);
      const yvalsBytes = interpolationBufferBytes(1 * count);
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "lgrind(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgrind(yvals)",
      );
      assertInterpolationNumber(x, "lgrind(x)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          xvalsBytes,
          yvalsBytes,
          interpolationBufferBytes(2 * count),
          8,
          8,
        ],
        (errPtr, xvalsPtr, yvalsPtr, workPtr, outPtr, derivativePtr) => {
          module.HEAPF64.set(xvalsCopy, xvalsPtr >>> 3);
          module.HEAPF64.set(yvalsCopy, yvalsPtr >>> 3);
          const status = module._tspice_lgrind(
            count,
            xvalsPtr,
            yvalsPtr,
            workPtr,
            x,
            outPtr,
            derivativePtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            p: module.HEAPF64[outPtr >>> 3]!,
            dp: module.HEAPF64[derivativePtr >>> 3]!,
          };
        },
      );
    },
    lgrint: (xvals, yvals, x) => {
      const count = interpolationCount(xvals, 1, 268435455, "lgrint(xvals)");
      const otherCount = interpolationCount(
        yvals,
        1,
        268435455,
        "lgrint(yvals)",
      );
      if (otherCount !== count)
        throw new RangeError("lgrint() input array lengths do not match");
      interpolationBufferBytes(1 * count);
      const xvalsBytes = interpolationBufferBytes(1 * count);
      const yvalsBytes = interpolationBufferBytes(1 * count);
      const xvalsCopy = copyInterpolationValues(
        xvals,
        1 * count,
        "lgrint(xvals)",
      );
      const yvalsCopy = copyInterpolationValues(
        yvals,
        1 * count,
        "lgrint(yvals)",
      );
      assertInterpolationNumber(x, "lgrint(x)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, xvalsBytes, yvalsBytes, 8],
        (errPtr, xvalsPtr, yvalsPtr, outPtr) => {
          module.HEAPF64.set(xvalsCopy, xvalsPtr >>> 3);
          module.HEAPF64.set(yvalsCopy, yvalsPtr >>> 3);
          const status = module._tspice_lgrint(
            count,
            xvalsPtr,
            yvalsPtr,
            x,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    qderiv: (f0, f2, delta) => {
      const count = interpolationCount(f0, 1, 2147483646, "qderiv(f0)");
      const otherCount = interpolationCount(f2, 1, 2147483646, "qderiv(f2)");
      if (otherCount !== count)
        throw new RangeError("qderiv() input array lengths do not match");
      if (count === 0)
        throw new RangeError("qderiv() requires nonempty arrays");
      interpolationBufferBytes(1 * count);
      const f0Bytes = interpolationBufferBytes(1 * count);
      const f2Bytes = interpolationBufferBytes(1 * count);
      const f0Copy = copyInterpolationValues(f0, 1 * count, "qderiv(f0)");
      const f2Copy = copyInterpolationValues(f2, 1 * count, "qderiv(f2)");
      assertInterpolationNumber(delta, "qderiv(delta)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, f0Bytes, f2Bytes, interpolationBufferBytes(count)],
        (errPtr, f0Ptr, f2Ptr, outPtr) => {
          module.HEAPF64.set(f0Copy, f0Ptr >>> 3);
          module.HEAPF64.set(f2Copy, f2Ptr >>> 3);
          const status = module._tspice_qderiv(
            count,
            f0Ptr,
            f2Ptr,
            delta,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readInterpolationArray(module, outPtr, count);
        },
      );
    },
    clearc: (ndim, arrlen, bytes) => {
      assertSpiceInt32(ndim, "clearc(ndim)");
      assertSpiceInt32(arrlen, "clearc(arrlen)");
      const bytesLength = spiceStorageLength(
        bytes,
        "clearc(bytes)",
        WASM_MAX_ALLOC_BYTES,
      );
      // CSPICE handles widths below two before accessing the buffer.
      if (arrlen >= 2)
        assertSpiceStorageFits(ndim, bytesLength, "clearc()", arrlen);
      const bytesCopy = copySpiceStorage(
        bytes,
        bytesLength,
        "byte",
        "clearc(bytes)",
      );
      return withAllocs(
        module,
        [ERR_MAX_BYTES, Math.max(1, bytesCopy.length)],
        (errPtr, bytesPtr) => {
          module.HEAPU8.set(bytesCopy, bytesPtr >>> 0);
          const status = module._tspice_clearc(
            ndim,
            arrlen,
            bytesPtr,
            bytesCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = bytesPtr >>> 0;
          return Array.from(
            module.HEAPU8.subarray(begin, begin + bytesCopy.length),
          );
        },
      );
    },
    cleard: (ndim, values) => {
      assertSpiceInt32(ndim, "cleard(ndim)");
      const valuesLength = spiceStorageLength(
        values,
        "cleard(values)",
        WASM_MAX_ALLOC_BYTES / 8,
      );
      assertSpiceStorageFits(ndim, valuesLength, "cleard(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "double",
        "cleard(values)",
      );
      return withAllocs(
        module,
        [ERR_MAX_BYTES, Math.max(1, valuesCopy.length) * 8],
        (errPtr, valuesPtr) => {
          module.HEAPF64.set(valuesCopy, valuesPtr >>> 3);
          const status = module._tspice_cleard(
            ndim,
            valuesPtr,
            valuesCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = valuesPtr >>> 3;
          return Array.from(
            module.HEAPF64.subarray(begin, begin + valuesCopy.length),
          );
        },
      );
    },
    cleari: (ndim, values) => {
      assertSpiceInt32(ndim, "cleari(ndim)");
      const valuesLength = spiceStorageLength(
        values,
        "cleari(values)",
        WASM_MAX_ALLOC_BYTES / 4,
      );
      assertSpiceStorageFits(ndim, valuesLength, "cleari(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "int",
        "cleari(values)",
      );
      return withAllocs(
        module,
        [ERR_MAX_BYTES, Math.max(1, valuesCopy.length) * 4],
        (errPtr, valuesPtr) => {
          module.HEAP32.set(valuesCopy, valuesPtr >>> 2);
          const status = module._tspice_cleari(
            ndim,
            valuesPtr,
            valuesCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = valuesPtr >>> 2;
          return Array.from(
            module.HEAP32.subarray(begin, begin + valuesCopy.length),
          );
        },
      );
    },
    filld: (value, ndim, values) => {
      if (typeof value !== "number")
        throw new TypeError("filld(value) must be a number");
      assertSpiceInt32(ndim, "filld(ndim)");
      const valuesLength = spiceStorageLength(
        values,
        "filld(values)",
        WASM_MAX_ALLOC_BYTES / 8,
      );
      assertSpiceStorageFits(ndim, valuesLength, "filld(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "double",
        "filld(values)",
      );
      return withAllocs(
        module,
        [ERR_MAX_BYTES, Math.max(1, valuesCopy.length) * 8],
        (errPtr, valuesPtr) => {
          module.HEAPF64.set(valuesCopy, valuesPtr >>> 3);
          const status = module._tspice_filld(
            value,
            ndim,
            valuesPtr,
            valuesCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = valuesPtr >>> 3;
          return Array.from(
            module.HEAPF64.subarray(begin, begin + valuesCopy.length),
          );
        },
      );
    },
    filli: (value, ndim, values) => {
      assertSpiceInt32(value, "filli(value)");
      assertSpiceInt32(ndim, "filli(ndim)");
      const valuesLength = spiceStorageLength(
        values,
        "filli(values)",
        WASM_MAX_ALLOC_BYTES / 4,
      );
      assertSpiceStorageFits(ndim, valuesLength, "filli(values)");
      const valuesCopy = copySpiceStorage(
        values,
        valuesLength,
        "int",
        "filli(values)",
      );
      return withAllocs(
        module,
        [ERR_MAX_BYTES, Math.max(1, valuesCopy.length) * 4],
        (errPtr, valuesPtr) => {
          module.HEAP32.set(valuesCopy, valuesPtr >>> 2);
          const status = module._tspice_filli(
            value,
            ndim,
            valuesPtr,
            valuesCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = valuesPtr >>> 2;
          return Array.from(
            module.HEAP32.subarray(begin, begin + valuesCopy.length),
          );
        },
      );
    },
    moved: (source, ndim, destination) => {
      assertSpiceInt32(ndim, "moved(ndim)", { min: 0 });
      const sourceLength = spiceStorageLength(
        source,
        "moved(source)",
        WASM_MAX_ALLOC_BYTES / 8,
      );
      const destinationLength = spiceStorageLength(
        destination,
        "moved(destination)",
        WASM_MAX_ALLOC_BYTES / 8,
      );
      assertSpiceStorageFits(ndim, sourceLength, "moved(source)");
      assertSpiceStorageFits(ndim, destinationLength, "moved(destination)");
      const sourceCopy = copySpiceStorage(
        source,
        sourceLength,
        "double",
        "moved(source)",
      );
      const destinationCopy = copySpiceStorage(
        destination,
        destinationLength,
        "double",
        "moved(destination)",
      );
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          Math.max(1, sourceCopy.length) * 8,
          Math.max(1, destinationCopy.length) * 8,
        ],
        (errPtr, sourcePtr, destinationPtr) => {
          module.HEAPF64.set(sourceCopy, sourcePtr >>> 3);
          module.HEAPF64.set(destinationCopy, destinationPtr >>> 3);
          const status = module._tspice_moved(
            sourcePtr,
            sourceCopy.length,
            ndim,
            destinationPtr,
            destinationCopy.length,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const begin = destinationPtr >>> 3;
          return Array.from(
            module.HEAPF64.subarray(begin, begin + destinationCopy.length),
          );
        },
      );
    },
    eul2m: (angle3, angle2, angle1, axis3, axis2, axis1) => {
      assertFixedMatrixScalar(angle3, "eul2m(angle3)");
      assertFixedMatrixScalar(angle2, "eul2m(angle2)");
      assertFixedMatrixScalar(angle1, "eul2m(angle1)");
      assertSpiceInt32(axis3, "eul2m(axis3)");
      assertSpiceInt32(axis2, "eul2m(axis2)");
      assertSpiceInt32(axis1, "eul2m(axis1)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, rPtr) => {
        const status = module._tspice_eul2m(
          angle3,
          angle2,
          angle1,
          axis3,
          axis2,
          axis1,
          rPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        const rAt = rPtr >>> 3;
        return brandMat3RowMajorResult(module.HEAPF64.subarray(rAt, rAt + 9), {
          label: "eul2m result",
        });
      });
    },
    m2eul: (m, axis3, axis2, axis1) => {
      const mCopy = copyMatrixInput(m, "m2eul(m)");
      assertSpiceInt32(axis3, "m2eul(axis3)");
      assertSpiceInt32(axis2, "m2eul(axis2)");
      assertSpiceInt32(axis1, "m2eul(axis1)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 8, 8, 8],
        (errPtr, mPtr, angle3Ptr, angle2Ptr, angle1Ptr) => {
          module.HEAPF64.set(mCopy, mPtr >>> 3);
          const status = module._tspice_m2eul(
            mPtr,
            axis3,
            axis2,
            axis1,
            angle3Ptr,
            angle2Ptr,
            angle1Ptr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const angle3At = angle3Ptr >>> 3;
          const angle2At = angle2Ptr >>> 3;
          const angle1At = angle1Ptr >>> 3;
          return {
            angle3: module.HEAPF64[angle3At + 0]!,
            angle2: module.HEAPF64[angle2At + 0]!,
            angle1: module.HEAPF64[angle1At + 0]!,
          };
        },
      );
    },
    m2q: (m) => {
      const mCopy = copyMatrixInput(m, "m2q(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 32],
        (errPtr, mPtr, qPtr) => {
          module.HEAPF64.set(mCopy, mPtr >>> 3);
          const status = module._tspice_m2q(mPtr, qPtr, errPtr, ERR_MAX_BYTES);
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const qAt = qPtr >>> 3;
          return [
            module.HEAPF64[qAt + 0]!,
            module.HEAPF64[qAt + 1]!,
            module.HEAPF64[qAt + 2]!,
            module.HEAPF64[qAt + 3]!,
          ];
        },
      );
    },
    q2m: (q) => {
      const qCopy = rotationQuaternion(q, "q2m(q)", true);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 32, 72],
        (errPtr, qPtr, rPtr) => {
          module.HEAPF64.set(qCopy, qPtr >>> 3);
          const status = module._tspice_q2m(qPtr, rPtr, errPtr, ERR_MAX_BYTES);
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const rAt = rPtr >>> 3;
          return brandMat3RowMajorResult(
            module.HEAPF64.subarray(rAt, rAt + 9),
            { label: "q2m result" },
          );
        },
      );
    },
    qxq: (q1, q2) => {
      const q1Copy = rotationQuaternion(q1, "qxq(q1)", true);
      const q2Copy = rotationQuaternion(q2, "qxq(q2)", true);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 32, 32, 32],
        (errPtr, q1Ptr, q2Ptr, qoutPtr) => {
          module.HEAPF64.set(q1Copy, q1Ptr >>> 3);
          module.HEAPF64.set(q2Copy, q2Ptr >>> 3);
          const status = module._tspice_qxq(
            q1Ptr,
            q2Ptr,
            qoutPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const qoutAt = qoutPtr >>> 3;
          return [
            module.HEAPF64[qoutAt + 0]!,
            module.HEAPF64[qoutAt + 1]!,
            module.HEAPF64[qoutAt + 2]!,
            module.HEAPF64[qoutAt + 3]!,
          ];
        },
      );
    },
    qdq2av: (q, dq) => {
      const qCopy = rotationQuaternion(q, "qdq2av(q)", true);
      const dqCopy = rotationQuaternion(dq, "qdq2av(dq)", true);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 32, 32, 24],
        (errPtr, qPtr, dqPtr, avPtr) => {
          module.HEAPF64.set(qCopy, qPtr >>> 3);
          module.HEAPF64.set(dqCopy, dqPtr >>> 3);
          const status = module._tspice_qdq2av(
            qPtr,
            dqPtr,
            avPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const avAt = avPtr >>> 3;
          return [
            module.HEAPF64[avAt + 0]!,
            module.HEAPF64[avAt + 1]!,
            module.HEAPF64[avAt + 2]!,
          ];
        },
      );
    },
    raxisa: (m) => {
      const mCopy = copyMatrixInput(m, "raxisa(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 24, 8],
        (errPtr, mPtr, axisPtr, anglePtr) => {
          module.HEAPF64.set(mCopy, mPtr >>> 3);
          const status = module._tspice_raxisa(
            mPtr,
            axisPtr,
            anglePtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const axisAt = axisPtr >>> 3;
          const angleAt = anglePtr >>> 3;
          return {
            axis: [
              module.HEAPF64[axisAt + 0]!,
              module.HEAPF64[axisAt + 1]!,
              module.HEAPF64[axisAt + 2]!,
            ],
            angle: module.HEAPF64[angleAt + 0]!,
          };
        },
      );
    },
    dazldr: (x, y, z, azccw, elplsz) => {
      assertFixedMatrixScalar(x, "dazldr(x)");
      assertFixedMatrixScalar(y, "dazldr(y)");
      assertFixedMatrixScalar(z, "dazldr(z)");
      const azccwFlag = Number(jacobianFlag(azccw));
      const elplszFlag = Number(jacobianFlag(elplsz));
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_dazldr(
          x,
          y,
          z,
          azccwFlag,
          elplszFlag,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "dazldr result");
      });
    },
    dcyldr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dcyldr(x)");
      assertFixedMatrixScalar(y, "dcyldr(y)");
      assertFixedMatrixScalar(z, "dcyldr(z)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_dcyldr(
          x,
          y,
          z,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "dcyldr result");
      });
    },
    dgeodr: (x, y, z, re, f) => {
      assertFixedMatrixScalar(x, "dgeodr(x)");
      assertFixedMatrixScalar(y, "dgeodr(y)");
      assertFixedMatrixScalar(z, "dgeodr(z)");
      assertFixedMatrixScalar(re, "dgeodr(re)");
      assertFixedMatrixScalar(f, "dgeodr(f)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_dgeodr(
          x,
          y,
          z,
          re,
          f,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "dgeodr result");
      });
    },
    dlatdr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dlatdr(x)");
      assertFixedMatrixScalar(y, "dlatdr(y)");
      assertFixedMatrixScalar(z, "dlatdr(z)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_dlatdr(
          x,
          y,
          z,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "dlatdr result");
      });
    },
    dpgrdr: (body, x, y, z, re, f) => {
      assertFixedMatrixScalar(x, "dpgrdr(x)");
      assertFixedMatrixScalar(y, "dpgrdr(y)");
      assertFixedMatrixScalar(z, "dpgrdr(z)");
      assertFixedMatrixScalar(re, "dpgrdr(re)");
      assertFixedMatrixScalar(f, "dpgrdr(f)");
      const bytes = new TextEncoder().encode(jacobianBody(body));
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, bytes.length + 1],
        (errPtr, outPtr, bodyPtr) => {
          module.HEAPU8.set(bytes, bodyPtr >>> 0);
          module.HEAPU8[(bodyPtr >>> 0) + bytes.length] = 0;
          const status = module._tspice_dpgrdr(
            bodyPtr,
            x,
            y,
            z,
            re,
            f,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "dpgrdr result");
        },
      );
    },
    drdazl: (range, az, el, azccw, elplsz) => {
      assertFixedMatrixScalar(range, "drdazl(range)");
      assertFixedMatrixScalar(az, "drdazl(az)");
      assertFixedMatrixScalar(el, "drdazl(el)");
      const azccwFlag = Number(jacobianFlag(azccw));
      const elplszFlag = Number(jacobianFlag(elplsz));
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_drdazl(
          range,
          az,
          el,
          azccwFlag,
          elplszFlag,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "drdazl result");
      });
    },
    drdcyl: (radius, lon, z) => {
      assertFixedMatrixScalar(radius, "drdcyl(radius)");
      assertFixedMatrixScalar(lon, "drdcyl(lon)");
      assertFixedMatrixScalar(z, "drdcyl(z)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_drdcyl(
          radius,
          lon,
          z,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "drdcyl result");
      });
    },
    drdgeo: (lon, lat, alt, re, f) => {
      assertFixedMatrixScalar(lon, "drdgeo(lon)");
      assertFixedMatrixScalar(lat, "drdgeo(lat)");
      assertFixedMatrixScalar(alt, "drdgeo(alt)");
      assertFixedMatrixScalar(re, "drdgeo(re)");
      assertFixedMatrixScalar(f, "drdgeo(f)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_drdgeo(
          lon,
          lat,
          alt,
          re,
          f,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "drdgeo result");
      });
    },
    drdlat: (radius, lon, lat) => {
      assertFixedMatrixScalar(radius, "drdlat(radius)");
      assertFixedMatrixScalar(lon, "drdlat(lon)");
      assertFixedMatrixScalar(lat, "drdlat(lat)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_drdlat(
          radius,
          lon,
          lat,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "drdlat result");
      });
    },
    drdpgr: (body, lon, lat, alt, re, f) => {
      assertFixedMatrixScalar(lon, "drdpgr(lon)");
      assertFixedMatrixScalar(lat, "drdpgr(lat)");
      assertFixedMatrixScalar(alt, "drdpgr(alt)");
      assertFixedMatrixScalar(re, "drdpgr(re)");
      assertFixedMatrixScalar(f, "drdpgr(f)");
      const bytes = new TextEncoder().encode(jacobianBody(body));
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, bytes.length + 1],
        (errPtr, outPtr, bodyPtr) => {
          module.HEAPU8.set(bytes, bodyPtr >>> 0);
          module.HEAPU8[(bodyPtr >>> 0) + bytes.length] = 0;
          const status = module._tspice_drdpgr(
            bodyPtr,
            lon,
            lat,
            alt,
            re,
            f,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "drdpgr result");
        },
      );
    },
    drdsph: (radius, colat, lon) => {
      assertFixedMatrixScalar(radius, "drdsph(radius)");
      assertFixedMatrixScalar(colat, "drdsph(colat)");
      assertFixedMatrixScalar(lon, "drdsph(lon)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_drdsph(
          radius,
          colat,
          lon,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "drdsph result");
      });
    },
    dsphdr: (x, y, z) => {
      assertFixedMatrixScalar(x, "dsphdr(x)");
      assertFixedMatrixScalar(y, "dsphdr(y)");
      assertFixedMatrixScalar(z, "dsphdr(z)");
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_dsphdr(
          x,
          y,
          z,
          outPtr,
          errPtr,
          ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "dsphdr result");
      });
    },
    det: (m) => {
      const mCopy = copyMatrixInput(m, "det(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 8],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_det(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    diags2: (symmat) => {
      const symmatCopy = copyFixedMatrix2(symmat);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 32, 32, 32],
        (errPtr, symmatPtr, diagPtr, rotatePtr) => {
          module.HEAPF64.set(symmatCopy, symmatPtr >> 3);
          const status = module._tspice_diags2(
            symmatPtr,
            diagPtr,
            rotatePtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            diag: readFixedMatrix2(module, diagPtr),
            rotate: readFixedMatrix2(module, rotatePtr),
          };
        },
      );
    },
    ident: () => {
      return withAllocs(module, [ERR_MAX_BYTES, 72], (errPtr, outPtr) => {
        const status = module._tspice_ident(outPtr, errPtr, ERR_MAX_BYTES);
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
        return readFixedMatrixResult(module, outPtr, "ident result");
      });
    },
    invert: (m) => {
      const mCopy = copyMatrixInput(m, "invert(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_invert(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "invert result");
        },
      );
    },
    invort: (m) => {
      const mCopy = copyMatrixInput(m, "invort(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_invort(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "invort result");
        },
      );
    },
    isrot: (m, ntol, dtol) => {
      const mCopy = copyMatrixInput(m, "isrot(m)");
      assertFixedMatrixScalar(ntol, "isrot(ntol)");
      assertFixedMatrixScalar(dtol, "isrot(dtol)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 4],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_isrot(
            mPtr,
            ntol,
            dtol,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >> 2] !== 0;
        },
      );
    },
    mequ: (m) => {
      const mCopy = copyMatrixInput(m, "mequ(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_mequ(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "mequ result");
        },
      );
    },
    mtxm: (a, b) => {
      const aCopy = copyMatrixInput(a, "mtxm(a)");
      const bCopy = copyMatrixInput(b, "mtxm(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72, 72],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_mtxm(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "mtxm result");
        },
      );
    },
    mxmt: (a, b) => {
      const aCopy = copyMatrixInput(a, "mxmt(a)");
      const bCopy = copyMatrixInput(b, "mxmt(b)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72, 72],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >> 3);
          module.HEAPF64.set(bCopy, bPtr >> 3);
          const status = module._tspice_mxmt(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "mxmt result");
        },
      );
    },
    trace: (m) => {
      const mCopy = copyMatrixInput(m, "trace(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 8],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_trace(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >> 3]!;
        },
      );
    },
    xpose: (m) => {
      const mCopy = copyMatrixInput(m, "xpose(m)");
      return withAllocs(
        module,
        [ERR_MAX_BYTES, 72, 72],
        (errPtr, mPtr, outPtr) => {
          module.HEAPF64.set(mCopy, mPtr >> 3);
          const status = module._tspice_xpose(
            mPtr,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readFixedMatrixResult(module, outPtr, "xpose result");
        },
      );
    },
    mequg: (m1, nr, nc) => {
      matrixDimension(nr, "mequg(nr)");
      matrixDimension(nc, "mequg(nc)");
      const m1Count = matrixElementCount(nr, nc);
      checkMatrixInputLength(m1, m1Count, "mequg(m1)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mequg(m1)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(m1Count),
        ],
        (errPtr, m1Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          const status = module._tspice_mequg(
            m1Ptr,
            nr,
            nc,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, m1Count);
        },
      );
    },
    mtxmg: (m1, m2, nc1, nr1r2, nc2) => {
      matrixDimension(nc1, "mtxmg(nc1)");
      matrixDimension(nr1r2, "mtxmg(nr1r2)", true);
      matrixDimension(nc2, "mtxmg(nc2)");
      const k = Math.max(0, nr1r2);
      checkMatrixProductRows(nc1);
      const m1Count = matrixElementCount(k, nc1);
      const m2Count = matrixElementCount(k, nc2);
      const outCount = matrixElementCount(nc1, nc2);
      checkMatrixInputLength(m1, m1Count, "mtxmg(m1)");
      checkMatrixInputLength(m2, m2Count, "mtxmg(m2)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mtxmg(m1)");
      const m2Copy = copyGeneralVector(m2, m2Count, "mtxmg(m2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(m2Count),
          generalVectorBufferBytes(outCount),
        ],
        (errPtr, m1Ptr, m2Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          module.HEAPF64.set(m2Copy, m2Ptr >>> 3);
          const status = module._tspice_mtxmg(
            m1Ptr,
            m2Ptr,
            nc1,
            nr1r2,
            nc2,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, outCount);
        },
      );
    },
    mtxvg: (m1, v2, nc1, nr1r2) => {
      matrixDimension(nc1, "mtxvg(nc1)");
      matrixDimension(nr1r2, "mtxvg(nr1r2)");
      const m1Count = matrixElementCount(nr1r2, nc1);
      const v2Count = matrixElementCount(nr1r2, 1);
      const outCount = matrixElementCount(nc1, 1);
      checkMatrixInputLength(m1, m1Count, "mtxvg(m1)");
      checkMatrixInputLength(v2, v2Count, "mtxvg(v2)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mtxvg(m1)");
      const v2Copy = copyGeneralVector(v2, v2Count, "mtxvg(v2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(v2Count),
          generalVectorBufferBytes(outCount),
        ],
        (errPtr, m1Ptr, v2Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >>> 3);
          const status = module._tspice_mtxvg(
            m1Ptr,
            v2Ptr,
            nc1,
            nr1r2,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, outCount);
        },
      );
    },
    mxmg: (m1, m2, nr1, nc1r2, nc2) => {
      matrixDimension(nr1, "mxmg(nr1)");
      matrixDimension(nc1r2, "mxmg(nc1r2)", true);
      matrixDimension(nc2, "mxmg(nc2)");
      const k = Math.max(0, nc1r2);
      checkMatrixProductRows(nr1);
      const m1Count = matrixElementCount(nr1, k);
      const m2Count = matrixElementCount(k, nc2);
      const outCount = matrixElementCount(nr1, nc2);
      checkMatrixInputLength(m1, m1Count, "mxmg(m1)");
      checkMatrixInputLength(m2, m2Count, "mxmg(m2)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mxmg(m1)");
      const m2Copy = copyGeneralVector(m2, m2Count, "mxmg(m2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(m2Count),
          generalVectorBufferBytes(outCount),
        ],
        (errPtr, m1Ptr, m2Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          module.HEAPF64.set(m2Copy, m2Ptr >>> 3);
          const status = module._tspice_mxmg(
            m1Ptr,
            m2Ptr,
            nr1,
            nc1r2,
            nc2,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, outCount);
        },
      );
    },
    mxmtg: (m1, m2, nr1, nc1c2, nr2) => {
      matrixDimension(nr1, "mxmtg(nr1)");
      matrixDimension(nc1c2, "mxmtg(nc1c2)");
      matrixDimension(nr2, "mxmtg(nr2)");
      checkMatrixProductRows(nr1);
      const m1Count = matrixElementCount(nr1, nc1c2);
      const m2Count = matrixElementCount(nr2, nc1c2);
      const outCount = matrixElementCount(nr1, nr2);
      checkMatrixInputLength(m1, m1Count, "mxmtg(m1)");
      checkMatrixInputLength(m2, m2Count, "mxmtg(m2)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mxmtg(m1)");
      const m2Copy = copyGeneralVector(m2, m2Count, "mxmtg(m2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(m2Count),
          generalVectorBufferBytes(outCount),
        ],
        (errPtr, m1Ptr, m2Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          module.HEAPF64.set(m2Copy, m2Ptr >>> 3);
          const status = module._tspice_mxmtg(
            m1Ptr,
            m2Ptr,
            nr1,
            nc1c2,
            nr2,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, outCount);
        },
      );
    },
    mxvg: (m1, v2, nr1, nc1r2) => {
      matrixDimension(nr1, "mxvg(nr1)");
      matrixDimension(nc1r2, "mxvg(nc1r2)");
      const m1Count = matrixElementCount(nr1, nc1r2);
      const v2Count = matrixElementCount(nc1r2, 1);
      const outCount = matrixElementCount(nr1, 1);
      checkMatrixInputLength(m1, m1Count, "mxvg(m1)");
      checkMatrixInputLength(v2, v2Count, "mxvg(v2)");
      const m1Copy = copyGeneralVector(m1, m1Count, "mxvg(m1)");
      const v2Copy = copyGeneralVector(v2, v2Count, "mxvg(v2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(m1Count),
          generalVectorBufferBytes(v2Count),
          generalVectorBufferBytes(outCount),
        ],
        (errPtr, m1Ptr, v2Ptr, outPtr) => {
          module.HEAPF64.set(m1Copy, m1Ptr >>> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >>> 3);
          const status = module._tspice_mxvg(
            m1Ptr,
            v2Ptr,
            nr1,
            nc1r2,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, outCount);
        },
      );
    },
    vtmvg: (v1, matrix, v2, nrow, ncol) => {
      matrixDimension(nrow, "vtmvg(nrow)");
      matrixDimension(ncol, "vtmvg(ncol)");
      const v1Count = matrixElementCount(nrow, 1);
      const matrixCount = matrixElementCount(nrow, ncol);
      const v2Count = matrixElementCount(ncol, 1);
      checkMatrixInputLength(v1, v1Count, "vtmvg(v1)");
      checkMatrixInputLength(matrix, matrixCount, "vtmvg(matrix)");
      checkMatrixInputLength(v2, v2Count, "vtmvg(v2)");
      const v1Copy = copyGeneralVector(v1, v1Count, "vtmvg(v1)");
      const matrixCopy = copyGeneralVector(
        matrix,
        matrixCount,
        "vtmvg(matrix)",
      );
      const v2Copy = copyGeneralVector(v2, v2Count, "vtmvg(v2)");
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(v1Count),
          generalVectorBufferBytes(matrixCount),
          generalVectorBufferBytes(v2Count),
          generalVectorBufferBytes(1),
        ],
        (errPtr, v1Ptr, matrixPtr, v2Ptr, outPtr) => {
          module.HEAPF64.set(v1Copy, v1Ptr >>> 3);
          module.HEAPF64.set(matrixCopy, matrixPtr >>> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >>> 3);
          const status = module._tspice_vtmvg(
            v1Ptr,
            matrixPtr,
            v2Ptr,
            nrow,
            ncol,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          const out = module.HEAPF64[outPtr >>> 3];
          if (typeof out !== "number")
            throw new RangeError("Invalid VTMVG output pointer");
          return out;
        },
      );
    },
    xposeg: (matrix, nrow, ncol) => {
      matrixDimension(nrow, "xposeg(nrow)", true);
      matrixDimension(ncol, "xposeg(ncol)", true);
      const r = Math.max(0, nrow),
        c = Math.max(0, ncol);
      const matrixCount = matrixElementCount(r, c);
      checkMatrixInputLength(matrix, matrixCount, "xposeg(matrix)");
      const matrixCopy = copyGeneralVector(
        matrix,
        matrixCount,
        "xposeg(matrix)",
      );
      return withAllocs(
        module,
        [
          ERR_MAX_BYTES,
          generalVectorBufferBytes(matrixCount),
          generalVectorBufferBytes(matrixCount),
        ],
        (errPtr, matrixPtr, outPtr) => {
          module.HEAPF64.set(matrixCopy, matrixPtr >>> 3);
          const status = module._tspice_xposeg(
            matrixPtr,
            nrow,
            ncol,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, matrixCount);
        },
      );
    },
    vaddg: (a, b) => {
      const aLength = generalVectorDimension(a, "vaddg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vaddg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vaddg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vaddg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vaddg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, bytes],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vaddg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vdistg: (a, b) => {
      const aLength = generalVectorDimension(a, "vdistg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vdistg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vdistg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vdistg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vdistg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vdistg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    vdotg: (a, b) => {
      const aLength = generalVectorDimension(a, "vdotg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vdotg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vdotg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vdotg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vdotg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vdotg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    vequg: (v) => {
      const vLength = generalVectorDimension(v, "vequg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vequg(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vequg(
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vhatg: (v) => {
      const vLength = generalVectorDimension(v, "vhatg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vhatg(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vhatg(
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vlcomg: (a, v1, b, v2) => {
      const v1Length = generalVectorDimension(v1, "vlcomg(v1)", 2147483647);
      const v2Length = generalVectorDimension(v2, "vlcomg(v2)", 2147483647);
      if (v1Length !== v2Length)
        throw new RangeError("vlcomg() vectors must have equal lengths");
      assertGeneralVectorScalar(a, "vlcomg(a)");
      assertGeneralVectorScalar(b, "vlcomg(b)");
      const v1Copy = copyGeneralVector(v1, v1Length, "vlcomg(v1)");
      const v2Copy = copyGeneralVector(v2, v2Length, "vlcomg(v2)");
      const dimension = v1Copy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, bytes],
        (errPtr, v1Ptr, v2Ptr, outPtr) => {
          module.HEAPF64.set(v1Copy, v1Ptr >>> 3);
          module.HEAPF64.set(v2Copy, v2Ptr >>> 3);
          const status = module._tspice_vlcomg(
            a,
            v1Ptr,
            b,
            v2Ptr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vminug: (v) => {
      const vLength = generalVectorDimension(v, "vminug(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vminug(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vminug(
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vnormg: (v) => {
      const vLength = generalVectorDimension(v, "vnormg(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vnormg(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, 8],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vnormg(
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    vprojg: (a, b) => {
      const aLength = generalVectorDimension(a, "vprojg(a)", 2147483646);
      const bLength = generalVectorDimension(b, "vprojg(b)", 2147483646);
      if (aLength !== bLength)
        throw new RangeError("vprojg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vprojg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vprojg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, bytes],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vprojg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vrelg: (a, b) => {
      const aLength = generalVectorDimension(a, "vrelg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vrelg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vrelg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vrelg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vrelg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vrelg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    vsclg: (s, v) => {
      const vLength = generalVectorDimension(v, "vsclg(v)", 2147483647);
      assertGeneralVectorScalar(s, "vsclg(s)");
      const vCopy = copyGeneralVector(v, vLength, "vsclg(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vsclg(
            s,
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vsepg: (a, b) => {
      const aLength = generalVectorDimension(a, "vsepg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vsepg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vsepg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vsepg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vsepg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, 8],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vsepg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAPF64[outPtr >>> 3]!;
        },
      );
    },
    vsubg: (a, b) => {
      const aLength = generalVectorDimension(a, "vsubg(a)", 2147483647);
      const bLength = generalVectorDimension(b, "vsubg(b)", 2147483647);
      if (aLength !== bLength)
        throw new RangeError("vsubg() vectors must have equal lengths");
      const aCopy = copyGeneralVector(a, aLength, "vsubg(a)");
      const bCopy = copyGeneralVector(b, bLength, "vsubg(b)");
      const dimension = aCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, bytes],
        (errPtr, aPtr, bPtr, outPtr) => {
          module.HEAPF64.set(aCopy, aPtr >>> 3);
          module.HEAPF64.set(bCopy, bPtr >>> 3);
          const status = module._tspice_vsubg(
            aPtr,
            bPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return readGeneralVector(module, outPtr, dimension);
        },
      );
    },
    vzerog: (v) => {
      const vLength = generalVectorDimension(v, "vzerog(v)", 2147483647);
      const vCopy = copyGeneralVector(v, vLength, "vzerog(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, 4],
        (errPtr, vPtr, outPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_vzerog(
            vPtr,
            dimension,
            outPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2] !== 0;
        },
      );
    },
    unormg: (v) => {
      const vLength = generalVectorDimension(v, "unormg(v)", 2147483646);
      const vCopy = copyGeneralVector(v, vLength, "unormg(v)");
      const dimension = vCopy.length;
      const bytes = generalVectorBufferBytes(dimension);
      return withAllocs(
        module,
        [ERR_MAX_BYTES, bytes, bytes, 8],
        (errPtr, vPtr, outPtr, normPtr) => {
          module.HEAPF64.set(vCopy, vPtr >>> 3);
          const status = module._tspice_unormg(
            vPtr,
            dimension,
            outPtr,
            normPtr,
            errPtr,
            ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, ERR_MAX_BYTES, status);
          return {
            unit: readGeneralVector(module, outPtr, dimension),
            norm: module.HEAPF64[normPtr >>> 3]!,
          };
        },
      );
    },
    reclat: (rect) => tspiceCallReclat(module, rect),
    latrec: (radius, lon, lat) => tspiceCallLatrec(module, radius, lon, lat),
    recsph: (rect) => tspiceCallRecsph(module, rect),
    sphrec: (radius, colat, lon) =>
      tspiceCallSphrec(module, radius, colat, lon),

    vnorm: (v) => tspiceCallVnorm(module, v),
    vhat: (v) => tspiceCallVhat(module, v),
    vdot: (a, b) => tspiceCallVdot(module, a, b),
    vcrss: (a, b) => tspiceCallVcrss(module, a, b),

    vadd: (a, b) => tspiceCallVadd(module, a, b),
    vsub: (a, b) => tspiceCallVsub(module, a, b),
    vminus: (v) => tspiceCallVminus(module, v),
    vscl: (s, v) => tspiceCallVscl(module, s, v),

    mxm: (a, b) => tspiceCallMxm(module, a, b),

    mxv: (m, v) => tspiceCallMxv(module, m, v),
    mtxv: (m, v) => tspiceCallMtxv(module, m, v),

    rotate: (angle, axis) => {
      assertSpiceInt32(axis, "rotate(axis)");
      return tspiceCallRotate(module, angle, axis);
    },
    rotmat: (m, angle, axis) => {
      assertSpiceInt32(axis, "rotmat(axis)");
      return tspiceCallRotmat(module, m, angle, axis);
    },
    axisar: (axis, angle) => tspiceCallAxisar(module, axis, angle),

    georec: (lon, lat, alt, re, f) =>
      tspiceCallGeorec(module, lon, lat, alt, re, f),
    recgeo: (rect, re, f) => tspiceCallRecgeo(module, rect, re, f),
  };
}
