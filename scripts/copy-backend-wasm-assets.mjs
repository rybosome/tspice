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

function atomicWriteFileSync(destPath, bytes) {
  const dir = path.dirname(destPath);
  const base = path.basename(destPath);
  const tmpPath = path.join(
    dir,
    `.${base}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`,
  );

  let fd;
  try {
    fd = fs.openSync(tmpPath, "w");
    // Prefer an explicit write loop instead of `writeFileSync(fd, bytes)`.
    // Some Node/platform combos can surface short writes when using a raw fd.
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset, offset);
      if (written <= 0) {
        throw new Error(`Short write while copying ${destPath} (wrote ${written} bytes).`);
      }
      offset += written;
    }
    fs.fsyncSync(fd);
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } catch {
      // ignore
    }
  }

  fs.renameSync(tmpPath, destPath);
  fsyncDirBestEffort(dir);
}

function validateWasmSync(wasmPath, expectedSize) {
  const bytes = fs.readFileSync(wasmPath);

  if (bytes.length !== expectedSize) {
    throw new Error(
      `WASM copy appears incomplete/corrupt: ${wasmPath} has ${bytes.length} bytes, expected ${expectedSize}.`,
    );
  }

  // Fail fast on corrupted/partial writes.
  // `WebAssembly.validate()` is a quick check, but compiling gives us a stronger
  // signal (and better errors) when something has truncated/altered the bytes.
  try {
    // Buffer is a Uint8Array, and WebAssembly.Module accepts BufferSource.
    const module = new WebAssembly.Module(bytes);
    void module;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`WASM compilation failed after copy: ${wasmPath}: ${message}`);
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

  // Write atomically so test runners can't observe a partially-written .wasm.
  const srcBytes = fs.readFileSync(srcPath);
  atomicWriteFileSync(destPath, srcBytes);

  if (asset === WASM_BINARY_FILENAME) {
    validateWasmSync(destPath, srcBytes.length);
  }
}
