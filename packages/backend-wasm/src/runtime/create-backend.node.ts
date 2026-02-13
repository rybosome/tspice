import type { SpiceBackend } from "@rybosome/tspice-backend-contract";

import { assertEmscriptenModule, type EmscriptenModule } from "../lowlevel/exports.js";

import { createCoordsVectorsApi } from "../domains/coords-vectors.js";
import { createCellsWindowsApi } from "../domains/cells-windows.js";
import { createEphemerisApi } from "../domains/ephemeris.js";
import { createFramesApi } from "../domains/frames.js";
import { createGeometryApi } from "../domains/geometry.js";
import { createGeometryGfApi } from "../domains/geometry-gf.js";
import { createIdsNamesApi } from "../domains/ids-names.js";
import { createKernelsApi } from "../domains/kernels.js";
import { createKernelPoolApi } from "../domains/kernel-pool.js";
import { createTimeApi, getToolkitVersion } from "../domains/time.js";
import { createFileIoApi } from "../domains/file-io.js";
import { createErrorApi } from "../domains/error.js";
import { createDskApi } from "../domains/dsk.js";
import { createEkApi } from "../domains/ek.js";

import { createWasmFs } from "./fs.js";
import { createSpiceHandleRegistry } from "./spice-handles.js";
import { createVirtualOutputRegistry } from "./virtual-outputs.js";

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
const wasmBinaryCache = new Map<string, ArrayBuffer>();

function boundedCacheGet(key: string): ArrayBuffer | undefined {
  const hit = wasmBinaryCache.get(key);
  if (!hit) return undefined;
  // Refresh recency (Map preserves insertion order).
  wasmBinaryCache.delete(key);
  wasmBinaryCache.set(key, hit);
  return hit;
}

function boundedCacheSet(key: string, value: ArrayBuffer): void {
  // Refresh recency on overwrite (Map preserves insertion order).
  wasmBinaryCache.delete(key);
  wasmBinaryCache.set(key, value);

  while (wasmBinaryCache.size > WASM_BINARY_CACHE_MAX_ENTRIES) {
    const lruKey = wasmBinaryCache.keys().next().value as string | undefined;
    if (!lruKey) break;
    wasmBinaryCache.delete(lruKey);
  }
}

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
  const URL_SCHEME_WITH_AUTHORITY_RE = /^[A-Za-z][A-Za-z\d+.-]*:\/\//;
  const SINGLE_LETTER_SCHEME_RE = /^[A-Za-z]:/;

  const [{ readFile }, { fileURLToPath }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
  ]);

  // In Node, treat values as filesystem paths unless they are unambiguously a
  // URL (file://, or any other scheme://...) or a known non-fs scheme like
  // data: or blob:.
  const isWindowsDrivePath = WINDOWS_DRIVE_PATH_RE.test(wasmUrl);
  const isFileUrl = wasmUrl.startsWith("file://");

  if (!isWindowsDrivePath && !isFileUrl) {
    if (wasmUrl.startsWith("node:")) {
      const u = new URL(wasmUrl);
      throw new Error(
        `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
      );
    }

    if (wasmUrl.startsWith("blob:") || wasmUrl.startsWith("data:")) {
      const u = new URL(wasmUrl);
      throw new Error(
        `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
      );
    }

    if (URL_SCHEME_WITH_AUTHORITY_RE.test(wasmUrl)) {
      const u = new URL(wasmUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:" && u.protocol !== "file:") {
        throw new Error(
          `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
        );
      }
    }

    // Avoid treating `c:foo` as a Windows drive path; it's ambiguous and often a typo.
    // But allow longer values like `foo:bar/...` to be treated as filesystem paths.
    if (SINGLE_LETTER_SCHEME_RE.test(wasmUrl)) {
      const u = new URL(wasmUrl);
      throw new Error(
        `Unsupported wasmUrl scheme '${u.protocol}'. Expected http(s) URL, file:// URL, or a filesystem path.`,
      );
    }
  }

  const wasmPath = wasmUrl.startsWith("file://") ? fileURLToPath(wasmUrl) : wasmUrl;

  const cached = boundedCacheGet(wasmPath);
  if (cached) {
    return cached;
  }

  const bytes = await readFile(wasmPath);
  const buffer = toExactArrayBuffer(bytes);
  boundedCacheSet(wasmPath, buffer);
  return buffer;
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
    if (wasmUrl.startsWith("node:")) {
      throwUnsupportedScheme(new URL(wasmUrl));
    }

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

  // In Node, avoid Emscripten's fetch/instantiateStreaming path for:
  // - `file://...` URLs (Node's built-in `fetch` can't load them)
  // - plain filesystem paths when `fetch` exists
  // Instead, feed the bytes directly to Emscripten via `wasmBinary`.
  let wasmBinary: ArrayBuffer | Uint8Array | undefined;

  if (wasmUrl.startsWith("file://")) {
    wasmBinary = await (async () => {
      const [{ readFileSync, statSync }, { writeFile, rename }, { fileURLToPath }] =
        await Promise.all([
          import("node:fs"),
          import("node:fs/promises"),
          import("node:url"),
        ]);

      const usingDefaultWasmUrl = options.wasmUrl == null;
      const wasmPath = fileURLToPath(wasmUrl);

      type BufferSourceLike = ArrayBuffer | ArrayBufferView;
      type WebAssemblyLike = {
        validate(bytes: BufferSourceLike): boolean;
      };

      // `WebAssembly` is available in Node, but TypeScript only types it when the DOM
      // lib is enabled. Define a minimal type so we can use `validate()` without pulling
      // in browser-only lib typings.
      const wasmApi = (globalThis as unknown as { WebAssembly?: WebAssemblyLike }).WebAssembly;

      const assertMagicHeader = (
        bytes: Uint8Array,
        path: string,
        urlForMessage: string,
      ): void => {
        // Validate WASM magic header: 0x00 0x61 0x73 0x6d ("\0asm")
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
            `Invalid WASM magic header for ${path} (url=${urlForMessage}). ` +
              `Expected 00 61 73 6d ("\\0asm") but got ${prefix}${
                bytes.length > 8 ? " ..." : ""
              }.`,
          );
        }
      };

      const isValidWasm = (bytes: Uint8Array): boolean => {
        // Fail fast on truncated/corrupt cache restores.
        //
        // If `validate()` is unavailable (or stubbed), assume valid and let
        // instantiation fail with a real error.
        if (!wasmApi?.validate) {
          return true;
        }

        return wasmApi.validate(bytes);
      };

      const readBytesWithSizeCheck = (path: string, urlForMessage: string): Uint8Array => {
        const readWithSizeCheck = (): { bytes: Uint8Array; statSize: number } => {
          const bytes = readFileSync(path);
          const statSize = statSync(path).size;
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
              `WASM binary read size mismatch for ${path} (url=${urlForMessage}): ` +
                `readFileSync().length=${bytes.length} (previous=${firstReadSize}) ` +
                `statSync().size=${statSize} (previous=${firstStatSize}). ` +
                `This may indicate a transient/inconsistent filesystem state.`,
            );
          }
        }

        return bytes;
      };

      let lastValidationError: unknown;

      async function readValidatedOrNull(
        path: string,
        urlForMessage: string,
      ): Promise<Uint8Array | null> {
        try {
          const bytes = readBytesWithSizeCheck(path, urlForMessage);
          assertMagicHeader(bytes, path, urlForMessage);

          if (!isValidWasm(bytes)) {
            throw new Error(
              `WebAssembly.validate() returned false for ${path} (url=${urlForMessage}).`,
            );
          }

          return bytes;
        } catch (error) {
          lastValidationError = error;
          return null;
        }
      }

      // If turbo restores `dist/**` from cache, downstream tasks can sometimes observe
      // partially-written outputs. Validate the wasm bytes before loading.
      const initial = await readValidatedOrNull(wasmPath, wasmUrl);
      if (initial) {
        return initial;
      }

      // Retry briefly in case another process is still writing/restoring the file.
      for (const delayMs of [10, 25, 50, 100, 250]) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const retry = await readValidatedOrNull(wasmPath, wasmUrl);
        if (retry) {
          return retry;
        }
      }

      // If the dist wasm is still invalid, fall back to the checked-in Emscripten artifact
      // when running from a workspace checkout.
      if (usingDefaultWasmUrl) {
        const fallbackUrl = new URL(
          `../../emscripten/${WASM_BINARY_FILENAME}`,
          import.meta.url,
        );
        const fallbackPath = fileURLToPath(fallbackUrl);

        const fallback = await readValidatedOrNull(fallbackPath, fallbackUrl.href);
        if (fallback) {
          if (options.repairInvalidDistWasm === true) {
            // Best-effort repair so subsequent loads see a valid file.
            try {
              const tmpPath = `${wasmPath}.tmp.${process.pid}.${Date.now()}`;
              await writeFile(tmpPath, fallback);
              await rename(tmpPath, wasmPath);
            } catch {
              // ignore
            }
          }

          return fallback;
        }
      }

      const message =
        `Invalid/partial WASM binary at ${wasmPath}. ` +
        `Try rerunning backend-wasm build (pnpm -C packages/backend-wasm build) ` +
        `or ensure turbo cache outputs are fully restored before tests run.`;

      throw lastValidationError != null
        ? new Error(message, { cause: lastValidationError })
        : new Error(message);
    })();
  } else {
    try {
      wasmBinary = await readWasmBinaryForNode(wasmUrl);
    } catch (error) {
      throw new Error(
        `Failed to read tspice WASM binary (wasmUrl=${wasmUrl}): ${String(error)}`,
      );
    }
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
  const spiceHandles = createSpiceHandleRegistry();
  const virtualOutputs = createVirtualOutputRegistry();

  const backend = {
    kind: "wasm",
    ...createTimeApi(module, toolkitVersion),
    ...createKernelsApi(module, fsApi),
    ...createKernelPoolApi(module),
    ...createIdsNamesApi(module),
    ...createFramesApi(module),
    ...createEphemerisApi(module, spiceHandles, virtualOutputs),
    ...createGeometryApi(module),
    ...createGeometryGfApi(module),
    ...createCoordsVectorsApi(module),
    ...createFileIoApi(module, spiceHandles, virtualOutputs),
    ...createErrorApi(module),
    ...createCellsWindowsApi(module),
    ...createEkApi(module, spiceHandles),
    ...createDskApi(module, spiceHandles),
  } satisfies SpiceBackend;

  return backend;
}
