import type {
  AbCorr,
  Et2UtcFormat,
  Found,
  KernelKind,
  Matrix3,
  Matrix6,
  SpiceBackendWasm,
  State6,
} from "@rybosome/tspice-backend-contract";

export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;
};

export const WASM_JS_FILENAME = "tspice_backend_wasm.js" as const;
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm" as const;

type EmscriptenModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;

  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  _tspice_tkvrsn_toolkit(
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  _tspice_furnsh(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_unload(pathPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kclear(errPtr: number, errMaxBytes: number): number;
  _tspice_ktotal(kindPtr: number, outCountPtr: number, errPtr: number, errMaxBytes: number): number;
  _tspice_kdata(
    which: number,
    kindPtr: number,
    filePtr: number,
    fileMaxBytes: number,
    filtypPtr: number,
    filtypMaxBytes: number,
    sourcePtr: number,
    sourceMaxBytes: number,
    handlePtr: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FS: any;
};

const NOT_IMPL = () => {
  throw new Error("Not implemented yet");
};

function writeUtf8CString(module: EmscriptenModule, value: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  const ptr = module._malloc(encoded.length + 1);
  if (!ptr) {
    throw new Error("WASM malloc failed");
  }
  module.HEAPU8.set(encoded, ptr);
  module.HEAPU8[ptr + encoded.length] = 0;
  return ptr;
}

function throwWasmSpiceError(
  module: EmscriptenModule,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): never {
  const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
  throw new Error(message || `CSPICE call failed with code ${code}`);
}

function tspiceCall0(
  module: EmscriptenModule,
  fn: (errPtr: number, errMaxBytes: number) => number,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  if (!errPtr) {
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(errPtr);
  }
}

function tspiceCall1Path(
  module: EmscriptenModule,
  fn: (pathPtr: number, errPtr: number, errMaxBytes: number) => number,
  path: string,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const pathPtr = writeUtf8CString(module, path);
  if (!errPtr || !pathPtr) {
    if (pathPtr) module._free(pathPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(pathPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(pathPtr);
    module._free(errPtr);
  }
}

function tspiceCallKtotal(module: EmscriptenModule, kind: KernelKind): number {
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
  kind: KernelKind,
): Found<{ file: string; filtyp: string; source: string; handle: number }> {
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

  if (
    !errPtr ||
    !kindPtr ||
    !filePtr ||
    !filtypPtr ||
    !sourcePtr ||
    !handlePtr ||
    !foundPtr
  ) {
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

function getToolkitVersion(module: EmscriptenModule): string {
  const outMaxBytes = 256;
  const errMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);
  const errPtr = module._malloc(errMaxBytes);

  if (!outPtr || !errPtr) {
    if (errPtr) {
      module._free(errPtr);
    }
    if (outPtr) {
      module._free(outPtr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_tkvrsn_toolkit(
      outPtr,
      outMaxBytes,
      errPtr,
      errMaxBytes,
    );

    if (result !== 0) {
      const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
      throw new Error(message || `CSPICE call failed with code ${result}`);
    }

    return module.UTF8ToString(outPtr, outMaxBytes);
  } finally {
    module._free(errPtr);
    module._free(outPtr);
  }
}

export async function createWasmBackend(
  options: CreateWasmBackendOptions = {},
): Promise<SpiceBackendWasm> {
  const defaultWasmUrl = new URL(`./${WASM_BINARY_FILENAME}`, import.meta.url);
  const wasmUrl = options.wasmUrl?.toString() ?? defaultWasmUrl.href;

  const moduleUrl = new URL(`./${WASM_JS_FILENAME}`, import.meta.url);

  let createEmscriptenModule: (opts: Record<string, unknown>) => Promise<unknown>;
  try {
    ({ default: createEmscriptenModule } = (await import(moduleUrl.href)) as {
      default: (opts: Record<string, unknown>) => Promise<unknown>;
    });
  } catch (error) {
    throw new Error(
      `Failed to load tspice WASM glue from ${moduleUrl.href}: ${String(error)}`,
    );
  }

  let module: EmscriptenModule;
  try {
    module = (await createEmscriptenModule({
      locateFile(path: string, prefix: string) {
        if (path === WASM_BINARY_FILENAME) {
          return wasmUrl;
        }
        return `${prefix}${path}`;
      },
    })) as EmscriptenModule;
  } catch (error) {
    throw new Error(
      `Failed to initialize tspice WASM module (wasmUrl=${wasmUrl}): ${String(error)}`,
    );
  }

  if (
    typeof module._tspice_tkvrsn_toolkit !== "function" ||
    typeof module._malloc !== "function" ||
    typeof module._free !== "function" ||
    typeof module.UTF8ToString !== "function" ||
    typeof module._tspice_furnsh !== "function" ||
    typeof module._tspice_unload !== "function" ||
    typeof module._tspice_kclear !== "function" ||
    typeof module._tspice_ktotal !== "function" ||
    typeof module._tspice_kdata !== "function"
  ) {
    throw new Error("WASM module is missing expected exports");
  }

  // The toolkit version is constant for the lifetime of a loaded module.
  const toolkitVersion = getToolkitVersion(module);

  return {
    kind: "wasm",

    spiceVersion: () => toolkitVersion,

    // Phase 1
    furnsh(path: string) {
      tspiceCall1Path(module, module._tspice_furnsh, path);
    },
    unload(path: string) {
      tspiceCall1Path(module, module._tspice_unload, path);
    },
    kclear() {
      tspiceCall0(module, module._tspice_kclear);
    },

    ktotal(kind: KernelKind = "ALL") {
      return tspiceCallKtotal(module, kind);
    },

    kdata(which: number, kind: KernelKind = "ALL") {
      return tspiceCallKdata(module, which, kind);
    },
    str2et: NOT_IMPL,
    et2utc: NOT_IMPL as unknown as (et: number, format: Et2UtcFormat, prec: number) => string,

    // Phase 2
    bodn2c: NOT_IMPL as unknown as (name: string) => Found<{ code: number }>,
    bodc2n: NOT_IMPL as unknown as (code: number) => Found<{ name: string }>,
    namfrm: NOT_IMPL as unknown as (frameName: string) => Found<{ frameId: number }>,
    frmnam: NOT_IMPL as unknown as (frameId: number) => Found<{ frameName: string }>,

    // Phase 3
    spkezr: NOT_IMPL as unknown as (
      target: string,
      et: number,
      ref: string,
      abcorr: AbCorr,
      obs: string,
    ) => { state: State6; lt: number },

    pxform: NOT_IMPL as unknown as (from: string, to: string, et: number) => Matrix3,
    sxform: NOT_IMPL as unknown as (from: string, to: string, et: number) => Matrix6,

    // WASM-only
    writeFile(path: string, data: Uint8Array) {
      module.FS.writeFile(path, data);
    },
    loadKernel(path: string, data: Uint8Array) {
      const resolvedPath = path.startsWith("/") ? path : `/kernels/${path}`;
      const parent = resolvedPath.split("/").slice(0, -1).join("/") || "/";
      module.FS.mkdirTree(parent);
      module.FS.writeFile(resolvedPath, data);
      tspiceCall1Path(module, module._tspice_furnsh, resolvedPath);
    },
  };
}
