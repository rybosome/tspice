import type {
  AbCorr,
  EphemerisApi,
  SpiceHandle,
  SpkezrResult,
  SpkposResult,
  SpiceStateVector,
  SpiceVector3,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type { SpiceHandleRegistry } from "../runtime/spice-handles.js";
import type { VirtualOutputRegistry } from "../runtime/virtual-outputs.js";

const I32_MAX = 2147483647;

function isVirtualOutput(value: unknown): value is VirtualOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "virtual-output" &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

function resolveSpkPath(file: string | VirtualOutput, context: string): string {
  if (typeof file === "string") {
    return resolveKernelPath(file);
  }
  if (!isVirtualOutput(file)) {
    throw new Error(`${context}: expected VirtualOutput {kind:'virtual-output', path:string}`);
  }
  return resolveKernelPath(file.path);
}

function ensureParentDir(module: Pick<EmscriptenModule, "FS">, filePath: string): void {
  const dir = filePath.split("/").slice(0, -1).join("/") || "/";
  if (dir && dir !== "/") {
    module.FS.mkdirTree(dir);
  }
}

function callVoidHandle(
  module: EmscriptenModule,
  fn: (handle: number, errPtr: number, errMaxBytes: number) => number,
  handle: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const code = fn(handle, errPtr, WASM_ERR_MAX_BYTES);
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  });
}

function tspiceCallSpkezr(
  module: EmscriptenModule,
  target: string,
  et: number,
  ref: string,
  abcorr: string,
  obs: string,
): SpkezrResult {
  const targetPtr = writeUtf8CString(module, target);
  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const obsPtr = writeUtf8CString(module, obs);

  try {
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        6 * 8 + 7, // outState (+padding for alignment)
        8 + 7, // outLt (+padding for alignment)
      ],
      (errPtr, rawOutStatePtr, rawOutLtPtr) => {
        const outStatePtr = (rawOutStatePtr + 7) & ~7;
        const outLtPtr = (rawOutLtPtr + 7) & ~7;

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
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const state = Array.from(
          module.HEAPF64.subarray(outStatePtr >> 3, (outStatePtr >> 3) + 6),
        ) as unknown as SpiceStateVector;
        const lt = module.HEAPF64[outLtPtr >> 3] ?? 0;
        return { state, lt };
      },
    );
  } finally {
    module._free(obsPtr);
    module._free(abcorrPtr);
    module._free(refPtr);
    module._free(targetPtr);
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
  const targetPtr = writeUtf8CString(module, target);
  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const obsPtr = writeUtf8CString(module, obs);

  try {
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        3 * 8 + 7, // outPos (+padding for alignment)
        8 + 7, // outLt (+padding for alignment)
      ],
      (errPtr, rawOutPosPtr, rawOutLtPtr) => {
        const outPosPtr = (rawOutPosPtr + 7) & ~7;
        const outLtPtr = (rawOutLtPtr + 7) & ~7;

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
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const pos = Array.from(
          module.HEAPF64.subarray(outPosPtr >> 3, (outPosPtr >> 3) + 3),
        ) as unknown as SpiceVector3;
        const lt = module.HEAPF64[outLtPtr >> 3] ?? 0;
        return { pos, lt };
      },
    );
  } finally {
    module._free(obsPtr);
    module._free(abcorrPtr);
    module._free(refPtr);
    module._free(targetPtr);
  }
}

function tspiceCallSpkopn(
  module: EmscriptenModule,
  path: string,
  ifname: string,
  ncomch: number,
): number {
  const pathPtr = writeUtf8CString(module, path);
  const ifnamePtr = writeUtf8CString(module, ifname);

  try {
    return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
      module.HEAP32[outHandlePtr >> 2] = 0;
      const code = module._tspice_spkopn(pathPtr, ifnamePtr, ncomch, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
      return module.HEAP32[outHandlePtr >> 2] ?? 0;
    });
  } finally {
    module._free(ifnamePtr);
    module._free(pathPtr);
  }
}

function tspiceCallSpkopa(module: EmscriptenModule, path: string): number {
  const pathPtr = writeUtf8CString(module, path);

  try {
    return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
      module.HEAP32[outHandlePtr >> 2] = 0;
      const code = module._tspice_spkopa(pathPtr, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
      return module.HEAP32[outHandlePtr >> 2] ?? 0;
    });
  } finally {
    module._free(pathPtr);
  }
}

function tspiceCallSpkw08(
  module: EmscriptenModule,
  nativeHandle: number,
  body: number,
  center: number,
  frame: string,
  first: number,
  last: number,
  segid: string,
  degree: number,
  states: readonly number[],
  epoch1: number,
  step: number,
): void {
  const framePtr = writeUtf8CString(module, frame);
  const segidPtr = writeUtf8CString(module, segid);

  try {
    const n = states.length / 6;
    if (!Number.isSafeInteger(n) || n <= 0 || n * 6 !== states.length) {
      throw new Error("tspiceCallSpkw08(states): expected states.length to be a non-zero multiple of 6");
    }
    if (n > I32_MAX) {
      throw new Error(`tspiceCallSpkw08(states): expected n to be a 32-bit signed integer (got n=${n})`);
    }

    const statesBytes = n * 6 * 8;

    withAllocs(module, [WASM_ERR_MAX_BYTES, statesBytes + 7], (errPtr, rawStatesPtr) => {
      const statesPtr = (rawStatesPtr + 7) & ~7;

      if (states.length > 0) {
        module.HEAPF64.set(states, statesPtr >> 3);
      }

      const code = module._tspice_spkw08(
        nativeHandle,
        body,
        center,
        framePtr,
        first,
        last,
        segidPtr,
        degree,
        n,
        statesPtr,
        epoch1,
        step,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
    });
  } finally {
    module._free(segidPtr);
    module._free(framePtr);
  }
}

export function createEphemerisApi(
  module: EmscriptenModule,
  handles: SpiceHandleRegistry,
  virtualOutputs: VirtualOutputRegistry,
): EphemerisApi {
  const virtualOutputPathByHandle = new Map<SpiceHandle, string>();

  return {
    spkezr: (target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSpkezr(module, target, et, ref, abcorr, observer),

    spkpos: (target: string, et: number, ref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSpkpos(module, target, et, ref, abcorr, observer),

    spkopn: (file: string | VirtualOutput, ifname: string, ncomch: number) => {
      const resolved = resolveSpkPath(file, "spkopn(file)");
      ensureParentDir(module, resolved);
      const nativeHandle = tspiceCallSpkopn(module, resolved, ifname, ncomch);

      const handle = handles.register("SPK", nativeHandle);
      if (typeof file !== "string") {
        // `resolveSpkPath` already validated, but be defensive: callers can cast.
        if (!isVirtualOutput(file)) {
          throw new Error("spkopn(file): expected VirtualOutput {kind:'virtual-output', path:string}");
        }
        virtualOutputs.markOpen(resolved);
        virtualOutputPathByHandle.set(handle, resolved);
      }

      return handle;
    },

    spkopa: (file: string | VirtualOutput) => {
      const resolved = resolveSpkPath(file, "spkopa(file)");
      ensureParentDir(module, resolved);
      const nativeHandle = tspiceCallSpkopa(module, resolved);

      const handle = handles.register("SPK", nativeHandle);
      if (typeof file !== "string") {
        if (!isVirtualOutput(file)) {
          throw new Error("spkopa(file): expected VirtualOutput {kind:'virtual-output', path:string}");
        }
        virtualOutputs.markOpen(resolved);
        virtualOutputPathByHandle.set(handle, resolved);
      }

      return handle;
    },

    spkcls: (handle: SpiceHandle) => {
      const resolved = virtualOutputPathByHandle.get(handle);
      handles.close(
        handle,
        ["SPK"],
        (e) => callVoidHandle(module, module._tspice_spkcls, e.nativeHandle),
        "spkcls",
      );
      if (resolved) {
        virtualOutputs.markClosed(resolved);
        virtualOutputPathByHandle.delete(handle);
      }
    },
    spkw08: (
      handle: SpiceHandle,
      body: number,
      center: number,
      frame: string,
      first: number,
      last: number,
      segid: string,
      degree: number,
      states: readonly number[],
      epoch1: number,
      step: number,
    ) => {
      if (!Array.isArray(states)) {
        throw new Error("spkw08(states): expected an array");
      }
      if (states.length === 0 || states.length % 6 !== 0) {
        throw new Error("spkw08(): expected states.length to be a non-zero multiple of 6");
      }

      const n = states.length / 6;
      if (!Number.isSafeInteger(n) || n <= 0 || n > I32_MAX) {
        throw new Error(`spkw08(): expected states.length/6 to be a 32-bit signed integer (got n=${n})`);
      }

      const nativeHandle = handles.lookup(handle, ["SPK"], "spkw08").nativeHandle;
      tspiceCallSpkw08(module, nativeHandle, body, center, frame, first, last, segid, degree, states, epoch1, step);
    },
  };
}
