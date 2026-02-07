import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import { loadTestKernels } from "./test-kernels.js";

describe("@rybosome/tspice-backend-node file-io", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("can open/search/close a DAF SPK", async () => {
    const backend = createNodeBackend();

    const { spk } = await loadTestKernels();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));
    const spkPath = path.join(tmpDir, "de405s.bsp");
    fs.writeFileSync(spkPath, spk);

    const handle = backend.dafopr(spkPath);
    backend.dafbfs(handle);
    expect(backend.daffna(handle)).toBe(true);
    backend.dafcls(handle);
  });

  itNative("throws on double-close", async () => {
    const backend = createNodeBackend();

    const { spk } = await loadTestKernels();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));
    const spkPath = path.join(tmpDir, "de405s.bsp");
    fs.writeFileSync(spkPath, spk);

    const handle = backend.dafopr(spkPath);
    backend.dafcls(handle);
    expect(() => backend.dafcls(handle)).toThrow(/invalid|closed/i);
  });

  itNative("throws on invalid handle usage", () => {
    const backend = createNodeBackend();

    expect(() => backend.dafcls(123 as any)).toThrow(/invalid|closed/i);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));
    const dlaPath = path.join(tmpDir, "test.dla");

    const dlaHandle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
    backend.dlacls(dlaHandle);

    const dasHandle = backend.dasopr(dlaPath);
    expect(() => backend.dafbfs(dasHandle as any)).toThrow(/DAF/i);
    backend.dascls(dasHandle);
  });

  itNative("can create and close a DLA file", () => {
    const backend = createNodeBackend();

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-file-io-"));
    const dlaPath = path.join(tmpDir, "create-close.dla");

    const handle = backend.dlaopn(dlaPath, "DLA", "TSPICE", 0);
    expect(backend.dlabfs(handle)).toEqual({ found: false });
    backend.dlacls(handle);

    expect(backend.exists(dlaPath)).toBe(true);
  });
});
