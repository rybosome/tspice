import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";
import type { DlaDescriptor, SpiceHandle } from "@rybosome/tspice-backend-contract";

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

  it("dascls can close a handle opened by dlaopn", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dascls-dlaopn-close.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dascls(handle);

    expect(backend.exists(path)).toBe(true);
  });

  it("dlabfs accepts a DAS handle opened by dasopr on a DLA file", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlabfs-dasopr.dla";
    const dlaHandle = backend.dlaopn(path, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(path);
    expect(backend.dlabfs(dasHandle)).toEqual({ found: false });
    backend.dascls(dasHandle);
  });

  it("validates dlafns(descr)", async () => {
    const backend = await createWasmBackend();

    const path = "file-io/dlafns-descr-validation.dla";
    const handle = backend.dlaopn(path, "DLA", "TSPICE", 0);

    const badDescr: DlaDescriptor = {
      bwdptr: 0,
      fwdptr: 0,
      ibase: 0,
      isize: 0,
      dbase: 0,
      dsize: 0,
      cbase: 0,
      // int32 max + 1
      csize: 2147483648,
    };

    expect(() => backend.dlafns(handle, badDescr)).toThrow(/32-bit|int32/i);
    backend.dlacls(handle);
  });
});
