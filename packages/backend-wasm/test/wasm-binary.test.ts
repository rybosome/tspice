import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readWasmBinaryForNode } from "../src/runtime/create-backend.node.js";

describe("wasmBinary loading (node runtime)", () => {
  it(
    "returns an exact-length, valid WASM ArrayBuffer (file:// + filesystem path)",
    async () => {
      const wasmFileUrl = new URL("../dist/tspice_backend_wasm.wasm", import.meta.url);
      const wasmPath = fileURLToPath(wasmFileUrl);
      const { size } = await stat(wasmPath);

      for (const wasmUrl of [wasmFileUrl.href, wasmPath]) {
        const buf = await readWasmBinaryForNode(wasmUrl);
        expect(buf).toBeDefined();
        expect(buf!.byteLength).toBe(size);
        expect(WebAssembly.validate(new Uint8Array(buf!))).toBe(true);
      }
    },
    20_000,
  );

  it("throws for unsupported URL schemes", async () => {
    await expect(readWasmBinaryForNode("data:application/wasm;base64,AA==")).rejects.toThrow(
      /Unsupported wasmUrl scheme/i,
    );
    await expect(readWasmBinaryForNode("ftp://example.com/tspice_backend_wasm.wasm")).rejects.toThrow(
      /Unsupported wasmUrl scheme/i,
    );
    await expect(readWasmBinaryForNode("node:fs")).rejects.toThrow(/Unsupported wasmUrl scheme/i);
  });
});
