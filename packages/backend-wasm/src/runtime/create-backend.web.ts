import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { assertEmscriptenModule, type EmscriptenModule } from "../lowlevel/exports.js";

import { createCoordsVectorsApi } from "../domains/coords-vectors.js";
import { createCellsWindowsApi } from "../domains/cells-windows.js";
import { createEphemerisApi } from "../domains/ephemeris.js";
import { createFramesApi } from "../domains/frames.js";
import { createGeometryApi } from "../domains/geometry.js";
import { createIdsNamesApi } from "../domains/ids-names.js";
import { createKernelsApi } from "../domains/kernels.js";
import { createTimeApi, getToolkitVersion } from "../domains/time.js";
import { createFileIoApi } from "../domains/file-io.js";
import { createErrorApi } from "../domains/error.js";

import { createWasmFs } from "./fs.js";

export type { CreateWasmBackendOptions } from "./create-backend-options.js";
import type { CreateWasmBackendOptions } from "./create-backend-options.js";

export const WASM_JS_FILENAME = "tspice_backend_wasm.web.js" as const;
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm" as const;

export async function createWasmBackend(
  options: CreateWasmBackendOptions = {},
): Promise<SpiceBackend & { kind: "wasm" }> {
  // NOTE: Keep this as a literal string so bundlers (Vite) don't generate a
  // runtime glob map for *every* file in this directory (including *.d.ts.map),
  // which can lead to JSON being imported as an ESM module.
  const defaultWasmUrl = new URL("../tspice_backend_wasm.wasm", import.meta.url);
  const wasmUrl = options.wasmUrl?.toString() ?? defaultWasmUrl.href;

  let createEmscriptenModule: (opts: Record<string, unknown>) => Promise<unknown>;
  try {
    // NOTE: This must be a literal import path so bundlers like Vite don't
    // rewrite the glue JS into an asset URL module (via `new URL(..., import.meta.url)`
    // + `?url`) which breaks `import()`.
    ({ default: createEmscriptenModule } = (await import(
      "../tspice_backend_wasm.web.js"
    )) as {
      default: (opts: Record<string, unknown>) => Promise<unknown>;
    });
  } catch (error) {
    throw new Error(
      `Failed to load tspice WASM glue (../${WASM_JS_FILENAME}): ${String(error)}`,
    );
  }

  const wasmLocator = wasmUrl;

  let module: EmscriptenModule;
  try {
    module = (await createEmscriptenModule({
      locateFile(path: string, prefix: string) {
        if (path === WASM_BINARY_FILENAME) {
          return wasmLocator;
        }
        return `${prefix}${path}`;
      },
    })) as EmscriptenModule;
  } catch (error) {
    throw new Error(
      `Failed to initialize tspice WASM module (wasmUrl=${wasmUrl}): ${String(error)}`,
    );
  }


  const validateEmscriptenModule = options.validateEmscriptenModule ?? true;
  if (validateEmscriptenModule) {
    assertEmscriptenModule(module);
  }


  // The toolkit version is constant for the lifetime of a loaded module.
  const toolkitVersion = getToolkitVersion(module);

  const fsApi = createWasmFs(module);

  const backendBase = {
    kind: "wasm",
    ...createTimeApi(module, toolkitVersion),
    ...createKernelsApi(module, fsApi),
    ...createIdsNamesApi(module),
    ...createFramesApi(module),
    ...createEphemerisApi(module),
    ...createGeometryApi(module),
    ...createCoordsVectorsApi(module),
    ...createFileIoApi(module),
    ...createErrorApi(module),
    ...createCellsWindowsApi(module),
  } satisfies SpiceBackend;

  return backendBase;
}
