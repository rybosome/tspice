import type {
  Found,
  KernelData,
  KernelInfo,
  KernelKind,
  KernelKindInput,
  KernelSource,
  KernelsApi,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withMalloc } from "../codec/alloc.js";
import { tspiceCall0, tspiceCall1Path } from "../codec/calls.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import type { WasmFsApi } from "../runtime/fs.js";
import { resolveKernelPath, writeKernelSource } from "../runtime/fs.js";

function extLower(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path;
  const idx = base.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return base.slice(idx).toLowerCase();
}

function guessTextKernelSubtype(path: string): KernelKind {
  switch (extLower(path)) {
    case ".tls":
    case ".lsk":
      return "LSK";
    case ".tf":
    case ".fk":
      return "FK";
    case ".ti":
    case ".ik":
      return "IK";
    case ".tsc":
    case ".sclk":
      return "SCLK";
    default:
      return "TEXT";
  }
}

function normalizeKindInput(kind: KernelKindInput | undefined): readonly string[] {
  if (kind == null) {
    return ["ALL"];
  }
  if (Array.isArray(kind)) {
    return kind;
  }

  // Allow callers to pass CSPICE-style multi-kind strings.
  const raw = String(kind);
  if (/\s/.test(raw)) {
    const parts = raw
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return parts;
  }

  return [raw];
}

function matchesKernelKind(requested: ReadonlySet<string>, kernel: KernelData): boolean {
  if (requested.size === 0) {
    return false;
  }
  if (requested.has("ALL")) {
    return true;
  }

  const filtyp = kernel.filtyp.toUpperCase();
  if (filtyp === "TEXT") {
    if (requested.has("TEXT")) {
      return true;
    }

    const subtype = guessTextKernelSubtype(kernel.file);
    return requested.has(subtype);
  }

  return requested.has(filtyp);
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
  return {
    furnsh: (kernel: KernelSource) => {
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
      tspiceCall1Path(module, module._tspice_unload, resolveKernelPath(path));
    },
    kclear: () => {
      tspiceCall0(module, module._tspice_kclear);
    },

    kinfo: (path: string) => {
      const resolved = resolveKernelPath(path);
      const totalAll = tspiceCallKtotal(module, "ALL");
      for (let i = 0; i < totalAll; i++) {
        const kd = tspiceCallKdata(module, i, "ALL");
        if (!kd.found) {
          continue;
        }

        // `kd.file` is already normalized for this backend (see `furnsh` above),
        // but normalize again to safely accept equivalent inputs like
        // `kernels/foo.tls`, `/kernels//foo.tls`, etc.
        if (resolveKernelPath(kd.file) !== resolved) {
          continue;
        }

        return {
          found: true,
          filtyp: kd.filtyp,
          source: kd.source,
          handle: kd.handle,
        } satisfies Found<KernelInfo>;
      }

      return { found: false };
    },

    kxtrct: (keywd, terms, wordsq) => {
      const termSet = new Set(terms);
      const words = [...wordsq.matchAll(/\S+/g)].map((m) => ({
        text: m[0],
        start: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length - 1,
      }));

      const keyIndex = words.findIndex((w) => w.text === keywd);
      if (keyIndex < 0) {
        return { found: false };
      }

      let termIndex = -1;
      for (let i = keyIndex + 1; i < words.length; i++) {
        if (termSet.has(words[i]!.text)) {
          termIndex = i;
          break;
        }
      }

      const startSub = words[keyIndex + 1]?.start;
      const endSub = termIndex >= 0 ? words[termIndex]!.start : wordsq.length;
      const substr = startSub == null ? "" : wordsq.slice(startSub, endSub);

      const removalStart = words[keyIndex]!.start;
      const removalEnd =
        termIndex >= 0 ? words[(termIndex - 1) as number]!.end + 1 : wordsq.length;
      const newWordsq = wordsq.slice(0, removalStart) + wordsq.slice(removalEnd);

      return { found: true, wordsq: newWordsq, substr };
    },

    kplfrm: (_frmcls, idset) => {
      // The WASM bundle doesn't currently export `tspice_kplfrm`; best-effort
      // approximation is to clear the output set.
      withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
        const result = module._tspice_scard(0, idset as unknown as number, errPtr, WASM_ERR_MAX_BYTES);
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
      });
    },

    ktotal: (kind: KernelKindInput = "ALL") => {
      const kinds = normalizeKindInput(kind).map((k) => k.toUpperCase());
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
