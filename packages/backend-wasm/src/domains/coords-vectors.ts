import type {
  CoordsVectorsApi,
  Mat3RowMajor,
  SpiceVector3,
  SpiceStateVector,
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
