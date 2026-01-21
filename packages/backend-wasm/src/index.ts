import type { KernelSource, SpiceBackend } from "@rybosome/tspice-backend-contract";

export type CreateWasmBackendOptions = {
  wasmUrl?: string | URL;
};

export const WASM_JS_FILENAME = "tspice_backend_wasm.js" as const;
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm" as const;

type EmscriptenModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;

  // Emscripten runtime helpers enabled via EXPORTED_RUNTIME_METHODS.
  ccall: (
    ident: string,
    returnType: "number" | "string" | "void" | null,
    argTypes: Array<"string" | "number" | "array" | "boolean">,
    args: unknown[],
  ) => unknown;
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
  HEAP32: Int32Array;

  // Historical signatures:
  // - (outPtr, errPtr, errMaxBytes) -> 0 on success
  // - (errPtr, errMaxBytes) -> count (or -1 on error)
  _tspice_ktotal_all(...args: number[]): number;

  _tspice_tkvrsn_toolkit(
    outPtr: number,
    outMaxBytes: number,
    errPtr: number,
    errMaxBytes: number,
  ): number;
};

function dirnamePosix(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx <= 0) {
    return "/";
  }
  return p.slice(0, idx);
}

function callWithError(
  module: EmscriptenModule,
  fn: "tspice_furnsh" | "tspice_unload",
  args: unknown[],
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  if (!errPtr) {
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module.ccall(
      fn,
      "number",
      // Note: ccall argTypes must match the args array passed below.
      [...args.map((arg) => (typeof arg === "string" ? "string" : "number")), "number", "number"],
      [...args, errPtr, errMaxBytes],
    ) as number;

    if (result !== 0) {
      const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
      throw new Error(message || `CSPICE call failed with code ${result}`);
    }
  } finally {
    module._free(errPtr);
  }
}

function ktotalAllWithError(module: EmscriptenModule): number {
  // Prefer calling the exported wrapper directly so we can support both
  // historical signatures without relying on emscripten `ccall` argTypes.
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  if (!errPtr) {
    throw new Error("WASM malloc failed");
  }

  try {
    if (module._tspice_ktotal_all.length === 2) {
      const result = module._tspice_ktotal_all(errPtr, errMaxBytes);
      if (result < 0) {
        const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
        throw new Error(message || "CSPICE call failed");
      }
      return result;
    }

    const outPtr = module._malloc(4);
    if (!outPtr) {
      throw new Error("WASM malloc failed");
    }

    try {
      const rc = module._tspice_ktotal_all(outPtr, errPtr, errMaxBytes);
      if (rc !== 0) {
        const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
        throw new Error(message || `CSPICE call failed with code ${rc}`);
      }
      return module.HEAP32[outPtr >> 2] ?? 0;
    } finally {
      module._free(outPtr);
    }
  } finally {
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
    typeof module.UTF8ToString !== "function" ||
    typeof module.ccall !== "function" ||
    typeof module.FS?.mkdirTree !== "function" ||
    typeof module.FS?.writeFile !== "function"
  ) {
    throw new Error("WASM module is missing expected exports");
  }

  // The toolkit version is constant for the lifetime of a loaded module.
  const toolkitVersion = getToolkitVersion(module);

  const backend: SpiceBackend = {
    kind: "wasm",
    spiceVersion: () => toolkitVersion,
    furnsh: (kernel: KernelSource) => {
      if (typeof kernel === "string") {
        callWithError(module, "tspice_furnsh", [kernel]);
        return;
      }

      const dir = dirnamePosix(kernel.path);
      if (dir && dir !== "/") {
        module.FS.mkdirTree(dir);
      }
      module.FS.writeFile(kernel.path, kernel.bytes);
      callWithError(module, "tspice_furnsh", [kernel.path]);
    },
    unload: (path: string) => {
      callWithError(module, "tspice_unload", [path]);
    },
    tkvrsn: (item) => {
      if (item !== "TOOLKIT") {
        throw new Error(`Unsupported tkvrsn item: ${item}`);
      }
      return toolkitVersion;
    },
  };

  // Internal testing hook (not part of the public backend contract).
  (backend as SpiceBackend & { __ktotalAll(): number }).__ktotalAll = () => {
    return ktotalAllWithError(module);
  };

  return backend;
}
