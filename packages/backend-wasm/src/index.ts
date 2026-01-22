import type {
  AbCorr,
  Et2UtcFormat,
  Found,
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
  _tspice_tkvrsn_toolkit(
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;

  // Future: FS + kernel loading exports.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FS?: any;
};

const NOT_IMPL = () => {
  throw new Error("Not implemented yet");
};

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
    typeof module.UTF8ToString !== "function"
  ) {
    throw new Error("WASM module is missing expected exports");
  }

  // The toolkit version is constant for the lifetime of a loaded module.
  const toolkitVersion = getToolkitVersion(module);

  return {
    kind: "wasm",

    spiceVersion: () => toolkitVersion,

    // Phase 1
    furnsh: NOT_IMPL,
    unload: NOT_IMPL,
    kclear: NOT_IMPL,
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
    writeFile: NOT_IMPL as unknown as (path: string, data: Uint8Array) => void,
    loadKernel: NOT_IMPL as unknown as (path: string) => void,
  };
}
