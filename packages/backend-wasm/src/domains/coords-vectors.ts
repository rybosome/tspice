import type {
  CoordsVectorsApi,
  SpiceMatrix3x3,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "../codec/errors.js";

function tspiceCallReclat(module: EmscriptenModule, rect: SpiceVector3): { radius: number; lon: number; lat: number } {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const rectPtr = module._malloc(3 * 8);
  const outRadiusPtr = module._malloc(8);
  const outLonPtr = module._malloc(8);
  const outLatPtr = module._malloc(8);

  if (!errPtr || !rectPtr || !outRadiusPtr || !outLonPtr || !outLatPtr) {
    for (const ptr of [outLatPtr, outLonPtr, outRadiusPtr, rectPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(rect, rectPtr >> 3);
    module.HEAPF64[outRadiusPtr >> 3] = 0;
    module.HEAPF64[outLonPtr >> 3] = 0;
    module.HEAPF64[outLatPtr >> 3] = 0;

    const result = module._tspice_reclat(rectPtr, outRadiusPtr, outLonPtr, outLatPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    return {
      radius: module.HEAPF64[outRadiusPtr >> 3] ?? 0,
      lon: module.HEAPF64[outLonPtr >> 3] ?? 0,
      lat: module.HEAPF64[outLatPtr >> 3] ?? 0,
    };
  } finally {
    module._free(outLatPtr);
    module._free(outLonPtr);
    module._free(outRadiusPtr);
    module._free(rectPtr);
    module._free(errPtr);
  }
}

function tspiceCallLatrec(module: EmscriptenModule, radius: number, lon: number, lat: number): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outRectPtr = module._malloc(3 * 8);

  if (!errPtr || !outRectPtr) {
    for (const ptr of [outRectPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set([0, 0, 0], outRectPtr >> 3);
    const result = module._tspice_latrec(radius, lon, lat, outRectPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outRectPtr >> 3, (outRectPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outRectPtr);
    module._free(errPtr);
  }
}

function tspiceCallRecsph(module: EmscriptenModule, rect: SpiceVector3): { radius: number; colat: number; lon: number } {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const rectPtr = module._malloc(3 * 8);
  const outRadiusPtr = module._malloc(8);
  const outColatPtr = module._malloc(8);
  const outLonPtr = module._malloc(8);

  if (!errPtr || !rectPtr || !outRadiusPtr || !outColatPtr || !outLonPtr) {
    for (const ptr of [outLonPtr, outColatPtr, outRadiusPtr, rectPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(rect, rectPtr >> 3);
    module.HEAPF64[outRadiusPtr >> 3] = 0;
    module.HEAPF64[outColatPtr >> 3] = 0;
    module.HEAPF64[outLonPtr >> 3] = 0;

    const result = module._tspice_recsph(rectPtr, outRadiusPtr, outColatPtr, outLonPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    return {
      radius: module.HEAPF64[outRadiusPtr >> 3] ?? 0,
      colat: module.HEAPF64[outColatPtr >> 3] ?? 0,
      lon: module.HEAPF64[outLonPtr >> 3] ?? 0,
    };
  } finally {
    module._free(outLonPtr);
    module._free(outColatPtr);
    module._free(outRadiusPtr);
    module._free(rectPtr);
    module._free(errPtr);
  }
}

function tspiceCallSphrec(module: EmscriptenModule, radius: number, colat: number, lon: number): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outRectPtr = module._malloc(3 * 8);

  if (!errPtr || !outRectPtr) {
    for (const ptr of [outRectPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set([0, 0, 0], outRectPtr >> 3);
    const result = module._tspice_sphrec(radius, colat, lon, outRectPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outRectPtr >> 3, (outRectPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outRectPtr);
    module._free(errPtr);
  }
}

function tspiceCallVnorm(module: EmscriptenModule, v: SpiceVector3): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const vPtr = module._malloc(3 * 8);
  const outNormPtr = module._malloc(8);

  if (!errPtr || !vPtr || !outNormPtr) {
    for (const ptr of [outNormPtr, vPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(v, vPtr >> 3);
    module.HEAPF64[outNormPtr >> 3] = 0;
    const result = module._tspice_vnorm(vPtr, outNormPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outNormPtr >> 3] ?? 0;
  } finally {
    module._free(outNormPtr);
    module._free(vPtr);
    module._free(errPtr);
  }
}

function tspiceCallVhat(module: EmscriptenModule, v: SpiceVector3): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const vPtr = module._malloc(3 * 8);
  const outPtr = module._malloc(3 * 8);

  if (!errPtr || !vPtr || !outPtr) {
    for (const ptr of [outPtr, vPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(v, vPtr >> 3);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);
    const result = module._tspice_vhat(vPtr, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outPtr);
    module._free(vPtr);
    module._free(errPtr);
  }
}

function tspiceCallVdot(module: EmscriptenModule, a: SpiceVector3, b: SpiceVector3): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const aPtr = module._malloc(3 * 8);
  const bPtr = module._malloc(3 * 8);
  const outDotPtr = module._malloc(8);

  if (!errPtr || !aPtr || !bPtr || !outDotPtr) {
    for (const ptr of [outDotPtr, bPtr, aPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(a, aPtr >> 3);
    module.HEAPF64.set(b, bPtr >> 3);
    module.HEAPF64[outDotPtr >> 3] = 0;
    const result = module._tspice_vdot(aPtr, bPtr, outDotPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outDotPtr >> 3] ?? 0;
  } finally {
    module._free(outDotPtr);
    module._free(bPtr);
    module._free(aPtr);
    module._free(errPtr);
  }
}

function tspiceCallVcrss(module: EmscriptenModule, a: SpiceVector3, b: SpiceVector3): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const aPtr = module._malloc(3 * 8);
  const bPtr = module._malloc(3 * 8);
  const outPtr = module._malloc(3 * 8);

  if (!errPtr || !aPtr || !bPtr || !outPtr) {
    for (const ptr of [outPtr, bPtr, aPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(a, aPtr >> 3);
    module.HEAPF64.set(b, bPtr >> 3);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);
    const result = module._tspice_vcrss(aPtr, bPtr, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outPtr);
    module._free(bPtr);
    module._free(aPtr);
    module._free(errPtr);
  }
}

function tspiceCallMxv(module: EmscriptenModule, m: SpiceMatrix3x3, v: SpiceVector3): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const mPtr = module._malloc(9 * 8);
  const vPtr = module._malloc(3 * 8);
  const outPtr = module._malloc(3 * 8);

  if (!errPtr || !mPtr || !vPtr || !outPtr) {
    for (const ptr of [outPtr, vPtr, mPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(m, mPtr >> 3);
    module.HEAPF64.set(v, vPtr >> 3);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);
    const result = module._tspice_mxv(mPtr, vPtr, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outPtr);
    module._free(vPtr);
    module._free(mPtr);
    module._free(errPtr);
  }
}

function tspiceCallMtxv(module: EmscriptenModule, m: SpiceMatrix3x3, v: SpiceVector3): SpiceVector3 {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const mPtr = module._malloc(9 * 8);
  const vPtr = module._malloc(3 * 8);
  const outPtr = module._malloc(3 * 8);

  if (!errPtr || !mPtr || !vPtr || !outPtr) {
    for (const ptr of [outPtr, vPtr, mPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(m, mPtr >> 3);
    module.HEAPF64.set(v, vPtr >> 3);
    module.HEAPF64.set([0, 0, 0], outPtr >> 3);
    const result = module._tspice_mtxv(mPtr, vPtr, outPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return Array.from(module.HEAPF64.subarray(outPtr >> 3, (outPtr >> 3) + 3)) as unknown as SpiceVector3;
  } finally {
    module._free(outPtr);
    module._free(vPtr);
    module._free(mPtr);
    module._free(errPtr);
  }
}

export function createCoordsVectorsApi(module: EmscriptenModule): CoordsVectorsApi {
  return {
    reclat: (rect) => tspiceCallReclat(module, rect),
    latrec: (radius, lon, lat) => tspiceCallLatrec(module, radius, lon, lat),
    recsph: (rect) => tspiceCallRecsph(module, rect),
    sphrec: (radius, colat, lon) => tspiceCallSphrec(module, radius, colat, lon),
    vnorm: (v) => tspiceCallVnorm(module, v),
    vhat: (v) => tspiceCallVhat(module, v),
    vdot: (a, b) => tspiceCallVdot(module, a, b),
    vcrss: (a, b) => tspiceCallVcrss(module, a, b),
    mxv: (m, v) => tspiceCallMxv(module, m, v),
    mtxv: (m, v) => tspiceCallMtxv(module, m, v),
  };
}
