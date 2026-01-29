import type {
  AbCorr,
  EphemerisApi,
  SpkezrResult,
  SpkposResult,
  SpiceStateVector,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

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
    const result = module._tspice_spkezr(targetPtr, et, refPtr, abcorrPtr, obsPtr, outStatePtr, outLtPtr, errPtr, errMaxBytes);
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
    const result = module._tspice_spkpos(targetPtr, et, refPtr, abcorrPtr, obsPtr, outPosPtr, outLtPtr, errPtr, errMaxBytes);
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

export function createEphemerisApi(module: EmscriptenModule): EphemerisApi {
  return {
    spkezr: (target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSpkezr(module, target, et, ref, abcorr, observer),

    spkpos: (target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSpkpos(module, target, et, ref, abcorr, observer),
  };
}
