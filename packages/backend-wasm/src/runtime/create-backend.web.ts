import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { assertEmscriptenModule, type EmscriptenModule } from "../lowlevel/exports.js";

import { createCoordsVectorsApi } from "../domains/coords-vectors.js";
import { createCellsWindowsApi } from "../domains/cells-windows.js";
import { createEphemerisApi } from "../domains/ephemeris.js";
import { createFramesApi } from "../domains/frames.js";
import { createGeometryApi } from "../domains/geometry.js";
import { createIdsNamesApi } from "../domains/ids-names.js";
import { createKernelsApi } from "../domains/kernels.js";
import { createKernelPoolApi } from "../domains/kernel-pool.js";
import { createTimeApi, getToolkitVersion } from "../domains/time.js";
import { createFileIoApi } from "../domains/file-io.js";
import { createErrorApi } from "../domains/error.js";
import { createDskApi } from "../domains/dsk.js";

import { createWasmFs } from "./fs.js";
import { createSpiceHandleRegistry } from "./spice-handles.js";

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

  const URL_SCHEME_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;
  const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/;

  const hasUrlScheme = (value: string): boolean =>
    URL_SCHEME_RE.test(value) && !WINDOWS_DRIVE_PATH_RE.test(value);

  if (hasUrlScheme(wasmUrl)) {
    const u = new URL(wasmUrl);

    // In web builds, `blob:` URLs are a real-world possibility (some bundlers and
    // runtime loaders produce them). `data:` is also generally fetchable.
    const allowedProtocols = new Set<string>(["http:", "https:", "file:", "blob:", "data:"]);

    if (!allowedProtocols.has(u.protocol)) {
      throw new Error(
        `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, blob: URL, data: URL, or a filesystem path.`,
      );
    }
  }

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
  const spiceHandles = createSpiceHandleRegistry();

  const backend = {
    kind: "wasm",
    ...createTimeApi(module, toolkitVersion),
    ...createKernelsApi(module, fsApi),
    ...createKernelPoolApi(module),
    ...createIdsNamesApi(module),
    ...createFramesApi(module),
    ...createEphemerisApi(module, spiceHandles),
    ...createGeometryApi(module),
    ...createCoordsVectorsApi(module),
    ...createFileIoApi(module, spiceHandles),
    ...createErrorApi(module),
    ...createCellsWindowsApi(module),
    ...createDskApi(module, spiceHandles),
  } satisfies SpiceBackend;

  return backend;
}
