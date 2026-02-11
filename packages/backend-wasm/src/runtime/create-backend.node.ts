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

import { createWasmFs } from "./fs.js";

export type { CreateWasmBackendOptions } from "./create-backend-options.js";
import type { CreateWasmBackendOptions } from "./create-backend-options.js";

export const WASM_JS_FILENAME = "tspice_backend_wasm.node.js" as const;
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
      "../tspice_backend_wasm.node.js"
    )) as {
      default: (opts: Record<string, unknown>) => Promise<unknown>;
    });
  } catch (error) {
    throw new Error(
      `Failed to load tspice WASM glue (../${WASM_JS_FILENAME}): ${String(error)}`,
    );
  }

  const wasmLocator = wasmUrl;

  // Node's built-in `fetch` can't load `file://...` URLs, so in Node we feed the
  // bytes directly to Emscripten via `wasmBinary`.
  const wasmBinary = wasmUrl.startsWith("file://")
    ? await (async () => {
        const [{ readFileSync, statSync }, { fileURLToPath }] = await Promise.all([
          import("node:fs"),
          import("node:url"),
        ]);

        const wasmPath = fileURLToPath(wasmUrl);

        const readWithSizeCheck = (): { bytes: Uint8Array; statSize: number } => {
          const bytes = readFileSync(wasmPath);
          const statSize = statSync(wasmPath).size;
          return { bytes, statSize };
        };

        // On macOS + Node 22 we've occasionally observed truncated reads leading to
        // `WebAssembly.instantiate(): section ... extends past end of the module`.
        // Sync reads + a size sanity-check seems to avoid the issue.
        let { bytes, statSize } = readWithSizeCheck();
        if (bytes.length !== statSize) {
          const firstReadSize = bytes.length;
          const firstStatSize = statSize;

          ({ bytes, statSize } = readWithSizeCheck());
          if (bytes.length !== statSize) {
            throw new Error(
              `WASM binary read size mismatch for ${wasmPath} (url=${wasmUrl}): ` +
                `readFileSync().length=${bytes.length} (previous=${firstReadSize}) ` +
                `statSync().size=${statSize} (previous=${firstStatSize}). ` +
                `This may indicate a transient/inconsistent filesystem state.`,
            );
          }
        }

        // Validate WASM magic header: 0x00 0x61 0x73 0x6d ("\\0asm")
        if (
          bytes.length < 4 ||
          bytes[0] !== 0x00 ||
          bytes[1] !== 0x61 ||
          bytes[2] !== 0x73 ||
          bytes[3] !== 0x6d
        ) {
          const prefixBytes = bytes.slice(0, Math.min(8, bytes.length));
          const prefix = Array.from(prefixBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
          throw new Error(
            `Invalid WASM magic header for ${wasmPath} (url=${wasmUrl}). ` +
              `Expected 00 61 73 6d ("\\\\0asm") but got ${prefix}${
                bytes.length > 8 ? " ..." : ""
              }.`,
          );
        }

        return bytes;
      })()
    : undefined;

  let module: EmscriptenModule;
  try {
    module = (await createEmscriptenModule({
      locateFile(path: string, prefix: string) {
        if (path === WASM_BINARY_FILENAME) {
          return wasmLocator;
        }
        return `${prefix}${path}`;
      },
      ...(wasmBinary ? { wasmBinary } : {}),
    })) as EmscriptenModule;
  } catch (error) {
    throw new Error(
      `Failed to initialize tspice WASM module (wasmUrl=${wasmUrl}): ${String(error)}`,
    );
  }


  const skipAssertViaEnv =
    process.env.TSPICE_WASM_SKIP_EMSCRIPTEN_ASSERT === "1" ||
    process.env.TSPICE_WASM_SKIP_EMSCRIPTEN_ASSERT === "true";

  const validateEmscriptenModule = options.validateEmscriptenModule ?? !skipAssertViaEnv;
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
    ...createKernelPoolApi(module),
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
