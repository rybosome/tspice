import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WASM_BINARY_FILENAME,
  WASM_NODE_JS_FILENAME,
  WASM_WEB_JS_FILENAME,
} from "./backend-wasm-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const backendWasmRoot = path.join(repoRoot, "packages", "backend-wasm");
const srcDir = path.join(backendWasmRoot, "emscripten");
const distDir = path.join(backendWasmRoot, "dist");

const assets = [WASM_WEB_JS_FILENAME, WASM_NODE_JS_FILENAME, WASM_BINARY_FILENAME];

function fsyncDirBestEffort(dir) {
  // Best-effort durability; not supported everywhere.
  try {
    const fd = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // ignore
  }
}

function validateWasmBinarySync(wasmPath) {
  const bytes = fs.readFileSync(wasmPath);

  // Fail fast on corrupted/partial writes.
  // `new WebAssembly.Module(...)` is stricter than `WebAssembly.validate` and
  // matches what `instantiate()` will do.
  try {
    // WebAssembly.Module expects a typed array or ArrayBuffer.
    // Buffer is a Uint8Array, so it is safe to pass directly.
    new WebAssembly.Module(bytes);
  } catch (error) {
    throw new Error(
      `WASM module compilation failed after copy: ${wasmPath}: ${String(error)}`,
    );
  }
}

function atomicCopyFileSync(srcPath, destPath, opts = {}) {
  const { validateTmp } = opts;

  const dir = path.dirname(destPath);
  const base = path.basename(destPath);
  const tmpPath = path.join(
    dir,
    `.${base}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`,
  );

  let renamed = false;
  try {
    // Copy to a temp file *in the destination directory* so the final swap can
    // be an atomic rename.
    fs.copyFileSync(srcPath, tmpPath);

    if (validateTmp) {
      validateTmp(tmpPath);
    }

    try {
      // On POSIX, rename over an existing file is atomic.
      fs.renameSync(tmpPath, destPath);
      renamed = true;
    } catch (error) {
      // On some platforms (notably Windows), rename() may fail when the target
      // exists. Best-effort fallback: unlink + retry.
      if (fs.existsSync(destPath)) {
        try {
          fs.unlinkSync(destPath);
        } catch {
          // ignore
        }

        fs.renameSync(tmpPath, destPath);
        renamed = true;
      } else {
        throw error;
      }
    }

    fsyncDirBestEffort(dir);
  } finally {
    // If we didn't successfully rename, clean up the temp file.
    if (!renamed && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    }
  }
}

for (const asset of assets) {
  const srcPath = path.join(srcDir, asset);
  const destPath = path.join(distDir, asset);

  if (!fs.existsSync(srcPath)) {
    throw new Error(
      `Missing ${asset}. Run node scripts/build-backend-wasm.mjs to generate it.`,
    );
  }

  fs.mkdirSync(distDir, { recursive: true });

  // Copy atomically so test runners can't observe partially-written assets.
  atomicCopyFileSync(srcPath, destPath, {
    validateTmp: asset === WASM_BINARY_FILENAME ? validateWasmBinarySync : undefined,
  });
}
