import type {
  Found,
  KernelData,
  KernelInfo,
  KernelKindInput,
  KernelSource,
  KernelsApi,
} from "@rybosome/tspice-backend-contract";
import { kxtrctJs, matchesKernelKind, normalizeKindInput } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { tspiceCall0, tspiceCall1Path } from "../codec/calls.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import type { WasmFsApi } from "../runtime/fs.js";
import { resolveKernelPath, writeKernelSource } from "../runtime/fs.js";

const CSPICE_KIND_SET = new Set<string>([
  "ALL",
  "SPK",
  "CK",
  "PCK",
  "DSK",
  "TEXT",
  "EK",
  "META",
]);

const TEXT_SUBTYPE_SET = new Set<string>(["LSK", "FK", "IK", "SCLK"]);

function cspiceKindQueryOrNull(kindsUpper: readonly string[]): string | null {
  if (kindsUpper.length === 0) {
    return null;
  }

  // Deduplicate while preserving input order.
  const requested = new Set<string>(kindsUpper);
  if (requested.has("ALL")) {
    return "ALL";
  }

  const hasText = requested.has("TEXT");

  let hasTextSubtype = false;
  let hasUnknown = false;
  for (const k of requested) {
    if (TEXT_SUBTYPE_SET.has(k)) {
      hasTextSubtype = true;
    }
    if (!CSPICE_KIND_SET.has(k) && !TEXT_SUBTYPE_SET.has(k)) {
      hasUnknown = true;
    }
  }

  // Only forward when the request is representable as a CSPICE kind string.
  if (hasUnknown) {
    return null;
  }
  if (hasTextSubtype && !hasText) {
    return null;
  }

  const nativeKinds: string[] = [];
  for (const k of requested) {
    if (CSPICE_KIND_SET.has(k) && k !== "ALL") {
      nativeKinds.push(k);
    }
  }

  return nativeKinds.length === 0 ? null : nativeKinds.join(" ");
}


function tspiceCallKtotal(module: EmscriptenModule, kind: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const kindPtr = writeUtf8CString(module, kind);
  const outCountPtr = module._malloc(4);
  if (!errPtr || !kindPtr || !outCountPtr) {
    if (outCountPtr) module._free(outCountPtr);
    if (kindPtr) module._free(kindPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[outCountPtr >> 2] = 0;
    const result = module._tspice_ktotal(kindPtr, outCountPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAP32[outCountPtr >> 2] ?? 0;
  } finally {
    module._free(outCountPtr);
    module._free(kindPtr);
    module._free(errPtr);
  }
}

function tspiceCallKdata(
  module: EmscriptenModule,
  which: number,
  kind: string,
): Found<KernelData> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const kindPtr = writeUtf8CString(module, kind);

  const fileMaxBytes = 2048;
  const filtypMaxBytes = 256;
  const sourceMaxBytes = 2048;
  const filePtr = module._malloc(fileMaxBytes);
  const filtypPtr = module._malloc(filtypMaxBytes);
  const sourcePtr = module._malloc(sourceMaxBytes);
  const handlePtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !kindPtr || !filePtr || !filtypPtr || !sourcePtr || !handlePtr || !foundPtr) {
    for (const ptr of [foundPtr, handlePtr, sourcePtr, filtypPtr, filePtr, kindPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[handlePtr >> 2] = 0;
    module.HEAP32[foundPtr >> 2] = 0;

    const result = module._tspice_kdata(
      which,
      kindPtr,
      filePtr,
      fileMaxBytes,
      filtypPtr,
      filtypMaxBytes,
      sourcePtr,
      sourceMaxBytes,
      handlePtr,
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
      file: module.UTF8ToString(filePtr, fileMaxBytes).trim(),
      filtyp: module.UTF8ToString(filtypPtr, filtypMaxBytes).trim(),
      source: module.UTF8ToString(sourcePtr, sourceMaxBytes).trim(),
      handle: module.HEAP32[handlePtr >> 2] ?? 0,
    };
  } finally {
    module._free(foundPtr);
    module._free(handlePtr);
    module._free(sourcePtr);
    module._free(filtypPtr);
    module._free(filePtr);
    module._free(kindPtr);
    module._free(errPtr);
  }
}

export function createKernelsApi(module: EmscriptenModule, fs: WasmFsApi): KernelsApi {
  let kinfoCache: Map<string, KernelInfo> | null = null;

  const clearKinfoCache = (): void => {
    kinfoCache = null;
  };

  const getKinfoCache = (): Map<string, KernelInfo> => {
    if (kinfoCache != null) {
      return kinfoCache;
    }

    const totalAll = tspiceCallKtotal(module, "ALL");
    const map = new Map<string, KernelInfo>();
    for (let i = 0; i < totalAll; i++) {
      const kd = tspiceCallKdata(module, i, "ALL");
      if (!kd.found) {
        continue;
      }

      // `kd.file` is already normalized for this backend (see `furnsh` below), but
      // normalize again to safely accept equivalent inputs like `kernels/foo.tls`,
      // `/kernels//foo.tls`, etc.
      const key = resolveKernelPath(kd.file);
      if (map.has(key)) {
        continue;
      }

      map.set(key, {
        filtyp: kd.filtyp,
        source: kd.source,
        handle: kd.handle,
      });
    }

    kinfoCache = map;
    return map;
  };

  return {
    furnsh: (kernel: KernelSource) => {
      clearKinfoCache();

      if (typeof kernel === "string") {
        // String kernels are treated as *WASM-FS paths*.
        //
        // In this backend, we normalize the provided path into the virtual
        // `/kernels/...` directory (see `resolveKernelPath`). This means
        // `furnsh("naif0012.tls")` and `furnsh("/kernels/naif0012.tls")` refer
        // to the same virtual file.
        //
        // NOTE: This behavior is backend-specific. In the Node backend,
        // `furnsh(string)` is an OS filesystem path.
        tspiceCall1Path(module, module._tspice_furnsh, resolveKernelPath(kernel));
        return;
      }

      // Byte-backed kernels are written into the WASM-FS before loading.
      // Callers should treat `kernel.path` as a *virtual* identifier.
      const path = writeKernelSource(module, fs, kernel);
      tspiceCall1Path(module, module._tspice_furnsh, path);
    },
    unload: (path: string) => {
      clearKinfoCache();
      tspiceCall1Path(module, module._tspice_unload, resolveKernelPath(path));
    },
    kclear: () => {
      clearKinfoCache();
      tspiceCall0(module, module._tspice_kclear);
    },

    kinfo: (path: string) => {
      const resolved = resolveKernelPath(path);
      const info = getKinfoCache().get(resolved);
      if (info == null) {
        return { found: false };
      }

      return { found: true, ...info } satisfies Found<KernelInfo>;
    },

    kxtrct: (keywd, terms, wordsq) => {
      return kxtrctJs(keywd, terms, wordsq);
    },
    kplfrm: (_frmcls, _idset) => {
      throw new Error("kplfrm not supported in current WASM bundle");
    },
    ktotal: (kind: KernelKindInput = "ALL") => {
      const kinds = normalizeKindInput(kind).map((k) => k.toUpperCase());
      if (kinds.length === 0) {
        return 0;
      }

      const nativeQuery = cspiceKindQueryOrNull(kinds);
      if (nativeQuery != null) {
        return tspiceCallKtotal(module, nativeQuery);
      }

      const requested = new Set(kinds);

      const totalAll = tspiceCallKtotal(module, "ALL");
      let count = 0;
      for (let i = 0; i < totalAll; i++) {
        const kd = tspiceCallKdata(module, i, "ALL");
        if (kd.found && matchesKernelKind(requested, kd)) {
          count++;
        }
      }
      return count;
    },

    kdata: (which: number, kind: KernelKindInput = "ALL") => {
      if (which < 0) {
        return { found: false };
      }

      const kinds = normalizeKindInput(kind).map((k) => k.toUpperCase());
      if (kinds.length === 0) {
        return { found: false };
      }

      const nativeQuery = cspiceKindQueryOrNull(kinds);
      if (nativeQuery != null) {
        return tspiceCallKdata(module, which, nativeQuery);
      }

      const requested = new Set(kinds);

      const totalAll = tspiceCallKtotal(module, "ALL");
      let matchIndex = 0;
      for (let i = 0; i < totalAll; i++) {
        const kd = tspiceCallKdata(module, i, "ALL");
        if (!kd.found || !matchesKernelKind(requested, kd)) {
          continue;
        }
        if (matchIndex === which) {
          return kd;
        }
        matchIndex++;
      }
      return { found: false };
    },
  };
}
