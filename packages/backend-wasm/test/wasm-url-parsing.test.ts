import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createWasmBackend as createNodeWasmBackend } from "@rybosome/tspice-backend-wasm";

// The package export resolves to the Node implementation in tests; import the web
// build explicitly.
import { createWasmBackend as createWebWasmBackend } from "../dist/index.web.js";

describe("wasmUrl parsing (node runtime)", () => {
  it("treats POSIX paths containing ':' as paths (not URL schemes)", async () => {
    // `foo:bar/...` is a valid POSIX path shape, but previously got treated as a URL
    // scheme and rejected.
    const wasmUrl = "foo:bar/tspice_backend_wasm.wasm";

    let err: unknown;
    try {
      await createNodeWasmBackend({ wasmUrl });
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Failed to read tspice WASM binary");
    expect((err as Error).message).not.toContain("Unsupported wasmUrl scheme");
  });

  it("rejects unsupported scheme:// URLs with a clear error", async () => {
    await expect(
      createNodeWasmBackend({ wasmUrl: "ftp://example.com/tspice_backend_wasm.wasm" }),
    ).rejects.toThrow(/Unsupported wasmUrl scheme 'ftp:'/);
  });

  it("treats drive-rooted Windows paths as paths", async () => {
    for (const wasmUrl of [
      String.raw`C:\tmp\tspice_backend_wasm.wasm`,
      "C:/tmp/tspice_backend_wasm.wasm",
    ]) {
      let err: unknown;
      try {
        await createNodeWasmBackend({ wasmUrl });
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Failed to read tspice WASM binary");
      expect((err as Error).message).not.toContain("Unsupported wasmUrl scheme");
    }
  });

  it("rejects ambiguous 'c:foo' forms as URL schemes (not drive paths)", async () => {
    await expect(createNodeWasmBackend({ wasmUrl: "c:foo" })).rejects.toThrow(
      /Unsupported wasmUrl scheme 'c:'/,
    );
  });
});

describe("wasmUrl parsing (web runtime)", () => {
  it(
    "accepts blob: URLs",
    async () => {
      const wasmPath = fileURLToPath(
        new URL("../dist/tspice_backend_wasm.wasm", import.meta.url),
      );
      const wasmBytes = await readFile(wasmPath);

      const blobUrl = URL.createObjectURL(
        new Blob([wasmBytes], { type: "application/wasm" }),
      );

      try {
        const backend = await createWebWasmBackend({ wasmUrl: blobUrl });
        expect(backend.kind).toBe("wasm");
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    },
    20_000,
  );

  it("rejects ambiguous 'c:foo' forms as URL schemes", async () => {
    await expect(createWebWasmBackend({ wasmUrl: "c:foo" })).rejects.toThrow(
      /Unsupported wasmUrl scheme 'c:'/,
    );
  });
});
