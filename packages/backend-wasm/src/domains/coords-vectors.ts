import type {
  CoordsVectorsApi,
  Mat3RowMajor,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import {
  assertMat3ArrayLike9,
  assertSpiceInt32,
  brandMat3RowMajor,
} from "@rybosome/tspice-core";

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
