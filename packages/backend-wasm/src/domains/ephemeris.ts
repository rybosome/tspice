import type {
  AbCorr,
  EphemerisApi,
  Found,
  SpiceHandle,
  SpiceIntCell,
  SpiceStateVector,
  SpiceVector3,
  SpiceWindow,
  SpkPackedDescriptor,
  SpkUnpackedDescriptor,
  SpkezrResult,
  SpkposResult,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32 } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
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
  withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
    const code = fn(handle, errPtr, WASM_ERR_MAX_BYTES);
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  });
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
  states: readonly number[] | Float64Array,
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
    if (states.length > I32_MAX) {
      throw new Error(
        `tspiceCallSpkw08(states): expected states.length to be a 32-bit signed integer (got states.length=${states.length})`,
      );
    }

    const statesBytes = n * 6 * 8;

    // Allocate states bytes with padding to ensure 8-byte alignment.
    withAllocs(module, [WASM_ERR_MAX_BYTES, statesBytes + 7], (errPtr, rawStatesPtr) => {
      const statesPtr = (rawStatesPtr + 7) & ~7;

      if (states.length > 0) {
        module.HEAPF64.set(states, statesPtr >> 3);
      }

      const code = module._tspice_spkw08_v2(
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
        states.length,
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
      [WASM_ERR_MAX_BYTES, 6 * 8, 8],
      (errPtr, outStatePtr, outLtPtr) => {
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
      [WASM_ERR_MAX_BYTES, 3 * 8, 8],
      (errPtr, outPosPtr, outLtPtr) => {
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

function tspiceCallSpkez(
  module: EmscriptenModule,
  target: number,
  et: number,
  ref: string,
  abcorr: string,
  observer: number,
): SpkezrResult {
  assertSpiceInt32(target, "spkez(target)");
  assertSpiceInt32(observer, "spkez(observer)");

  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);

  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 6 * 8, 8],
      (errPtr, outStatePtr, outLtPtr) => {
        module.HEAPF64[outLtPtr >> 3] = 0;

        const result = module._tspice_spkez(
          target,
          et,
          refPtr,
          abcorrPtr,
          observer,
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
    module._free(abcorrPtr);
    module._free(refPtr);
  }
}

function tspiceCallSpkezp(
  module: EmscriptenModule,
  target: number,
  et: number,
  ref: string,
  abcorr: string,
  observer: number,
): SpkposResult {
  assertSpiceInt32(target, "spkezp(target)");
  assertSpiceInt32(observer, "spkezp(observer)");

  const refPtr = writeUtf8CString(module, ref);
  const abcorrPtr = writeUtf8CString(module, abcorr);

  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 3 * 8, 8],
      (errPtr, outPosPtr, outLtPtr) => {
        module.HEAPF64[outLtPtr >> 3] = 0;

        const result = module._tspice_spkezp(
          target,
          et,
          refPtr,
          abcorrPtr,
          observer,
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
    module._free(abcorrPtr);
    module._free(refPtr);
  }
}

function tspiceCallSpkgeo(
  module: EmscriptenModule,
  target: number,
  et: number,
  ref: string,
  observer: number,
): SpkezrResult {
  assertSpiceInt32(target, "spkgeo(target)");
  assertSpiceInt32(observer, "spkgeo(observer)");

  const refPtr = writeUtf8CString(module, ref);
  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 6 * 8, 8],
      (errPtr, outStatePtr, outLtPtr) => {
        module.HEAPF64[outLtPtr >> 3] = 0;

        const result = module._tspice_spkgeo(
          target,
          et,
          refPtr,
          observer,
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
    module._free(refPtr);
  }
}

function tspiceCallSpkgps(
  module: EmscriptenModule,
  target: number,
  et: number,
  ref: string,
  observer: number,
): SpkposResult {
  assertSpiceInt32(target, "spkgps(target)");
  assertSpiceInt32(observer, "spkgps(observer)");

  const refPtr = writeUtf8CString(module, ref);
  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 3 * 8, 8],
      (errPtr, outPosPtr, outLtPtr) => {
        module.HEAPF64[outLtPtr >> 3] = 0;

        const result = module._tspice_spkgps(
          target,
          et,
          refPtr,
          observer,
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
    module._free(refPtr);
  }
}

function tspiceCallSpkssb(
  module: EmscriptenModule,
  target: number,
  et: number,
  ref: string,
): SpiceStateVector {
  assertSpiceInt32(target, "spkssb(target)");

  const refPtr = writeUtf8CString(module, ref);
  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 6 * 8],
      (errPtr, outStatePtr) => {
        const result = module._tspice_spkssb(
          target,
          et,
          refPtr,
          outStatePtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        return Array.from(
          module.HEAPF64.subarray(outStatePtr >> 3, (outStatePtr >> 3) + 6),
        ) as unknown as SpiceStateVector;
      },
    );
  } finally {
    module._free(refPtr);
  }
}

function tspiceCallSpkcov(
  module: EmscriptenModule,
  spk: string,
  idcode: number,
  cover: SpiceWindow,
): void {
  assertSpiceInt32(idcode, "spkcov(idcode)");

  const resolvedSpk = resolveKernelPath(spk);
  const spkPtr = writeUtf8CString(module, resolvedSpk);

  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
      const result = module._tspice_spkcov(
        spkPtr,
        idcode,
        cover as unknown as number,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );

      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(spkPtr);
  }
}

function tspiceCallSpkobj(
  module: EmscriptenModule,
  spk: string,
  ids: SpiceIntCell,
): void {
  const resolvedSpk = resolveKernelPath(spk);
  const spkPtr = writeUtf8CString(module, resolvedSpk);

  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
      const result = module._tspice_spkobj(
        spkPtr,
        ids as unknown as number,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );

      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(spkPtr);
  }
}

function tspiceCallSpksfs(
  module: EmscriptenModule,
  body: number,
  et: number,
): Found<{ handle: number; descr: SpkPackedDescriptor; ident: string }> {
  assertSpiceInt32(body, "spksfs(body)");

  // SIDLEN=40 + NUL.
  const identMaxBytes = 41;

  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, 4, 5 * 8, identMaxBytes, 4],
    (errPtr, outHandlePtr, outDescrPtr, outIdentPtr, outFoundPtr) => {
      module.HEAP32[outHandlePtr >> 2] = 0;
      module.HEAP32[outFoundPtr >> 2] = 0;
      module.HEAPU8[outIdentPtr] = 0;

      const result = module._tspice_spksfs(
        body,
        et,
        outHandlePtr,
        outDescrPtr,
        outIdentPtr,
        identMaxBytes,
        outFoundPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );

      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }

      const found = (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
      if (!found) {
        return { found: false };
      }

      const handle = module.HEAP32[outHandlePtr >> 2] ?? 0;
      const descr = Array.from(
        module.HEAPF64.subarray(outDescrPtr >> 3, (outDescrPtr >> 3) + 5),
      ) as unknown as SpkPackedDescriptor;
      const ident = readFixedWidthCString(module, outIdentPtr, identMaxBytes);

      return {
        found: true,
        handle,
        descr,
        ident,
      };
    },
  );
}

function tspiceCallSpkpds(
  module: EmscriptenModule,
  body: number,
  center: number,
  frame: string,
  type: number,
  first: number,
  last: number,
): SpkPackedDescriptor {
  assertSpiceInt32(body, "spkpds(body)");
  assertSpiceInt32(center, "spkpds(center)");
  assertSpiceInt32(type, "spkpds(type)");

  const framePtr = writeUtf8CString(module, frame);
  try {
    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 5 * 8],
      (errPtr, outDescrPtr) => {
        const result = module._tspice_spkpds(
          body,
          center,
          framePtr,
          type,
          first,
          last,
          outDescrPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        return Array.from(
          module.HEAPF64.subarray(outDescrPtr >> 3, (outDescrPtr >> 3) + 5),
        ) as unknown as SpkPackedDescriptor;
      },
    );
  } finally {
    module._free(framePtr);
  }
}

function tspiceCallSpkuds(
  module: EmscriptenModule,
  descr: SpkPackedDescriptor,
): SpkUnpackedDescriptor {
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, 5 * 8, 4, 4, 4, 4, 8, 8, 4, 4],
    (
      errPtr,
      descrPtr,
      outBodyPtr,
      outCenterPtr,
      outFramePtr,
      outTypePtr,
      outFirstPtr,
      outLastPtr,
      outBaddrPtr,
      outEaddrPtr,
    ) => {
      const base = descrPtr >> 3;
      for (let i = 0; i < 5; i++) {
        module.HEAPF64[base + i] = descr[i] ?? 0;
      }

      module.HEAP32[outBodyPtr >> 2] = 0;
      module.HEAP32[outCenterPtr >> 2] = 0;
      module.HEAP32[outFramePtr >> 2] = 0;
      module.HEAP32[outTypePtr >> 2] = 0;
      module.HEAPF64[outFirstPtr >> 3] = 0;
      module.HEAPF64[outLastPtr >> 3] = 0;
      module.HEAP32[outBaddrPtr >> 2] = 0;
      module.HEAP32[outEaddrPtr >> 2] = 0;

      const result = module._tspice_spkuds(
        descrPtr,
        outBodyPtr,
        outCenterPtr,
        outFramePtr,
        outTypePtr,
        outFirstPtr,
        outLastPtr,
        outBaddrPtr,
        outEaddrPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );

      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }

      return {
        body: module.HEAP32[outBodyPtr >> 2] ?? 0,
        center: module.HEAP32[outCenterPtr >> 2] ?? 0,
        frame: module.HEAP32[outFramePtr >> 2] ?? 0,
        type: module.HEAP32[outTypePtr >> 2] ?? 0,
        first: module.HEAPF64[outFirstPtr >> 3] ?? 0,
        last: module.HEAPF64[outLastPtr >> 3] ?? 0,
        baddr: module.HEAP32[outBaddrPtr >> 2] ?? 0,
        eaddr: module.HEAP32[outEaddrPtr >> 2] ?? 0,
      };
    },
  );
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

    spkez: (target: number, et: number, ref: string, abcorr: AbCorr | string, observer: number) =>
      tspiceCallSpkez(module, target, et, ref, abcorr, observer),

    spkezp: (target: number, et: number, ref: string, abcorr: AbCorr | string, observer: number) =>
      tspiceCallSpkezp(module, target, et, ref, abcorr, observer),

    spkgeo: (target: number, et: number, ref: string, observer: number) =>
      tspiceCallSpkgeo(module, target, et, ref, observer),

    spkgps: (target: number, et: number, ref: string, observer: number) =>
      tspiceCallSpkgps(module, target, et, ref, observer),

    spkssb: (target: number, et: number, ref: string) => tspiceCallSpkssb(module, target, et, ref),

    spkcov: (spk: string, idcode: number, cover: SpiceWindow) => tspiceCallSpkcov(module, spk, idcode, cover),

    spkobj: (spk: string, ids: SpiceIntCell) => tspiceCallSpkobj(module, spk, ids),

    spksfs: (body: number, et: number) => tspiceCallSpksfs(module, body, et),

    spkpds: (body: number, center: number, frame: string, type: number, first: number, last: number) =>
      tspiceCallSpkpds(module, body, center, frame, type, first, last),

    spkuds: (descr: SpkPackedDescriptor) => tspiceCallSpkuds(module, descr),

    // --- SPK writers -------------------------------------------------------

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
      states: readonly number[] | Float64Array,
      epoch1: number,
      step: number,
    ) => {
      if (!Array.isArray(states) && !(states instanceof Float64Array)) {
        throw new Error("spkw08(states): expected number[] or Float64Array");
      }
      if (states.length === 0 || states.length % 6 !== 0) {
        throw new Error("spkw08(): expected states.length to be a non-zero multiple of 6");
      }

      const n = states.length / 6;
      if (!Number.isSafeInteger(n) || n <= 0 || n > I32_MAX) {
        throw new Error(`spkw08(): expected states.length/6 to be a 32-bit signed integer (got n=${n})`);
      }
      if (states.length > I32_MAX) {
        throw new Error(
          `spkw08(): expected states.length to be a 32-bit signed integer (got states.length=${states.length})`,
        );
      }

      const nativeHandle = handles.lookup(handle, ["SPK"], "spkw08").nativeHandle;
      tspiceCallSpkw08(module, nativeHandle, body, center, frame, first, last, segid, degree, states, epoch1, step);
    },
  };
}
