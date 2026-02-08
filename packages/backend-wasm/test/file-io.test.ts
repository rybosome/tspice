import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";

describe("@rybosome/tspice-backend-wasm file-io", () => {
  it("can create and close a DLA file in the emscripten FS", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/create-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    expect(backend.dlabfs(handle)).toEqual({ found: false });
    backend.dlacls(handle);

    expect(backend.exists(path)).toBe(true);
  });

  it("throws on double-close", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/double-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(handle);
    expect(() => backend.dlacls(handle)).toThrow(/invalid|closed/i);
  });

  it("throws on invalid handle usage", async () => {
    const backend = await createWasmBackend();

    expect(() => backend.dafcls(123 as unknown as SpiceHandle)).toThrow(/invalid|closed/i);

    const path = "file-io/kind-mismatch.dla";
    const dlaHandle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(path);
    expect(() => backend.dafbfs(dasHandle as unknown as SpiceHandle)).toThrow(/DAF/i);
    backend.dascls(dasHandle);
  });
});
