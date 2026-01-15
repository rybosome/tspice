import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;
};

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
  const defaultWasmUrl = new URL("./tspice_backend_wasm.wasm", import.meta.url);
  const wasmUrl = options.wasmUrl?.toString() ?? defaultWasmUrl.href;

  const moduleUrl = new URL("./tspice_backend_wasm.js", import.meta.url);
  const { default: createEmscriptenModule } = (await import(moduleUrl.href)) as {
    default: (opts: Record<string, unknown>) => Promise<unknown>;
  };

  const module = (await createEmscriptenModule({
    locateFile(path: string, prefix: string) {
      if (path === "tspice_backend_wasm.wasm") {
        return wasmUrl;
      }
      return `${prefix}${path}`;
    },
  })) as EmscriptenModule;

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
          const message = module.UTF8ToString(errPtr, errMaxBytes);
          throw new Error(message || "CSPICE call failed");
        }

        return module.UTF8ToString(outPtr, outMaxBytes);
      } finally {
        module._free(errPtr);
        module._free(outPtr);
      }
    },
  };
}
