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

for (const asset of assets) {
  const srcPath = path.join(srcDir, asset);
  const destPath = path.join(distDir, asset);
  if (!fs.existsSync(srcPath)) {
    throw new Error(
      `Missing ${asset}. Run node scripts/build-backend-wasm.mjs to generate it.`,
    );
  }

  fs.mkdirSync(distDir, { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}
