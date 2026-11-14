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

/** Create a {@link CoordsVectorsApi} implementation backed by a WASM Emscripten module. */
export function createCoordsVectorsApi(
  module: EmscriptenModule,
): CoordsVectorsApi {
  return {
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
