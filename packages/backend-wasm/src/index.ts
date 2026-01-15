import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

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
};

export async function createWasmBackend(
  options: CreateWasmBackendOptions = {},
): Promise<SpiceBackend> {
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

  return {
    kind: "wasm",
    spiceVersion: () => {
      const outMaxBytes = 256;
      const errMaxBytes = 2048;
      const outPtr = module._malloc(outMaxBytes);
      const errPtr = module._malloc(errMaxBytes);

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
    },
  };
}
