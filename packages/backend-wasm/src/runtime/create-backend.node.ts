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
import { createEkApi } from "../domains/ek.js";

import { createWasmFs } from "./fs.js";

export type { CreateWasmBackendOptions } from "./create-backend-options.js";
import type { CreateWasmBackendOptions } from "./create-backend-options.js";

export const WASM_JS_FILENAME = "tspice_backend_wasm.node.js" as const;
export const WASM_BINARY_FILENAME = "tspice_backend_wasm.wasm" as const;

// Cache wasm binaries by URL to avoid repeated (sometimes flaky) disk reads.
//
// This cache MUST be bounded: in long-lived processes that construct backends
// dynamically (or accept user-provided URLs), an unbounded cache would retain
// bytes indefinitely.
const WASM_BINARY_CACHE_MAX_ENTRIES = 2;
const wasmBinaryCache = new Map<string, Uint8Array>();

function boundedCacheGet(key: string): Uint8Array | undefined {
  const hit = wasmBinaryCache.get(key);
  if (!hit) return undefined;
  // Refresh recency (Map preserves insertion order).
  wasmBinaryCache.delete(key);
  wasmBinaryCache.set(key, hit);
  return hit;
}

function boundedCacheSet(key: string, value: Uint8Array): void {
  // Refresh recency on overwrite (Map preserves insertion order).
  wasmBinaryCache.delete(key);
  wasmBinaryCache.set(key, value);

  while (wasmBinaryCache.size > WASM_BINARY_CACHE_MAX_ENTRIES) {
    const lruKey = wasmBinaryCache.keys().next().value as string | undefined;
    if (!lruKey) break;
    wasmBinaryCache.delete(lruKey);
  }
}

async function loadWasmBinaryFromFileUrl(wasmUrl: string): Promise<Uint8Array> {
  const cached = boundedCacheGet(wasmUrl);
  if (cached) {
    return cached;
  }

  const [{ readFile, stat }, { fileURLToPath }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
  ]);

  const wasmPath = fileURLToPath(wasmUrl);
  const expectedSize = (await stat(wasmPath)).size;

  // Guard against occasional short reads seen in some CI environments.
  const attempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const bytes = await readFile(wasmPath);

      if (bytes.byteLength !== expectedSize) {
        throw new Error(
          `Read truncated wasm binary (${bytes.byteLength} bytes, expected ${expectedSize}): ${wasmPath}`,
        );
      }

      const wasmValidate = (globalThis as any).WebAssembly?.validate as
        | ((bytes: Uint8Array) => boolean)
        | undefined;

      if (typeof wasmValidate === "function" && !wasmValidate(bytes)) {
        throw new Error(`Invalid wasm binary (WebAssembly.validate=false): ${wasmPath}`);
      }

      boundedCacheSet(wasmUrl, bytes);
      return bytes;
    } catch (error) {
      lastError = error;

      // Small backoff to reduce likelihood of repeated short reads.
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  throw new Error(`Failed to load wasm binary from ${wasmUrl}: ${String(lastError)}`);
}

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
    ? await loadWasmBinaryFromFileUrl(wasmUrl)
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
    ...createEkApi(module),
  } satisfies SpiceBackend;

  return backendBase;
}
