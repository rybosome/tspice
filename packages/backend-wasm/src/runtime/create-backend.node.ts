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

export function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Fast-path: if this view covers the whole underlying buffer, return it
  // directly (no copy).
  // NOTE: `Uint8Array#buffer` is typed as `ArrayBufferLike` (can be
  // `SharedArrayBuffer`). We only want to return an actual `ArrayBuffer`.
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }

  // Node Buffers can be views into a larger ArrayBuffer (and can be offset).
  // Passing `bytes.buffer` directly can include unrelated trailing bytes, and
  // getting `ArrayBuffer#slice` bounds wrong can truncate the module.
  //
  // Copy into a fresh, exact-length ArrayBuffer starting at 0.
  const uint8 = new Uint8Array(bytes.byteLength);
  uint8.set(bytes);
  return uint8.buffer;
}

export async function readWasmBinaryForNode(wasmUrl: string): Promise<ArrayBuffer | undefined> {
  // Allow http(s) URLs to be fetched by Emscripten.
  if (wasmUrl.startsWith("http://") || wasmUrl.startsWith("https://")) {
    return undefined;
  }

  const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/;
  const GENERIC_URL_SCHEME_RE = /^[A-Za-z][A-Za-z\d+.-]*:/;

  const [{ readFile }, { fileURLToPath }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
  ]);

  // Guard against unsupported URL schemes. We accept:
  // - file:// URLs
  // - filesystem paths
  // but reject everything else (data:, blob:, ftp:, node:, ...)
  //
  // Important: don't misclassify Windows drive paths like `C:\foo` as a URL
  // scheme (`c:`).
  const isWindowsDrivePath = WINDOWS_DRIVE_PATH_RE.test(wasmUrl);
  const isFileUrl = wasmUrl.startsWith("file://");

  if (!isWindowsDrivePath && !isFileUrl && GENERIC_URL_SCHEME_RE.test(wasmUrl)) {
    const u = new URL(wasmUrl);
    throw new Error(
      `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
    );
  }

  const wasmPath = wasmUrl.startsWith("file://") ? fileURLToPath(wasmUrl) : wasmUrl;
  const bytes = await readFile(wasmPath);

  return toExactArrayBuffer(bytes);
}

export async function createWasmBackend(
  options: CreateWasmBackendOptions = {},
): Promise<SpiceBackend & { kind: "wasm" }> {
  // NOTE: Keep this as a literal string so bundlers (Vite) don't generate a
  // runtime glob map for *every* file in this directory (including *.d.ts.map),
  // which can lead to JSON being imported as an ESM module.
  const defaultWasmUrl = new URL("../tspice_backend_wasm.wasm", import.meta.url);
  const wasmUrl = options.wasmUrl?.toString() ?? defaultWasmUrl.href;

  const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/;
  const URL_SCHEME_WITH_AUTHORITY_RE = /^[A-Za-z][A-Za-z\d+.-]*:\/\//;
  const SINGLE_LETTER_SCHEME_RE = /^[A-Za-z]:/;

  const isWindowsDrivePath = (value: string): boolean => WINDOWS_DRIVE_PATH_RE.test(value);
  const isAllowedNodeUrl = (value: string): boolean =>
    value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file://");

  const throwUnsupportedScheme = (u: URL): never => {
    throw new Error(
      `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
    );
  };

  // In Node, treat values as filesystem paths unless they are unambiguously a
  // URL (http(s)://, file://, or any other scheme://...) or a known non-fs
  // scheme like data: or blob:.
  if (!isWindowsDrivePath(wasmUrl) && !isAllowedNodeUrl(wasmUrl)) {
    if (wasmUrl.startsWith("blob:") || wasmUrl.startsWith("data:")) {
      throwUnsupportedScheme(new URL(wasmUrl));
    }

    if (URL_SCHEME_WITH_AUTHORITY_RE.test(wasmUrl)) {
      const u = new URL(wasmUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "file:") {
        throwUnsupportedScheme(u);
      }
    }

    // Avoid treating `c:foo` as a Windows drive path; it's ambiguous and often a typo.
    if (SINGLE_LETTER_SCHEME_RE.test(wasmUrl)) {
      throwUnsupportedScheme(new URL(wasmUrl));
    }
  }

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

  // In Node, avoid Emscripten's fetch/instantiateStreaming path (which is
  // fragile for `file://...` URLs and plain filesystem paths when `fetch`
  // exists). Instead, read the bytes directly and provide an *exact-length*
  // ArrayBuffer via `wasmBinary`.
  let wasmBinary: ArrayBuffer | undefined;
  try {
    wasmBinary = await readWasmBinaryForNode(wasmUrl);
  } catch (error) {
    throw new Error(
      `Failed to read tspice WASM binary (wasmUrl=${wasmUrl}): ${String(error)}`,
    );
  }

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
