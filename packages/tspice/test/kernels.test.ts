import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("kernel management", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: furnsh/kclear/ktotal/kdata/unload", async () => {
    const backend = await createBackend({ backend: "node" });
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    backend.furnsh(lskPath);
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    const first = backend.kdata(0, "ALL");
    expect(first.found).toBe(true);
    if (first.found) {
      expect(typeof first.file).toBe("string");
      expect(typeof first.filtyp).toBe("string");
      expect(typeof first.source).toBe("string");
      expect(typeof first.handle).toBe("number");
    }

    backend.unload(lskPath);
    // Some kernels may remain loaded implicitly; allow either unload -> 0 or kclear -> 0.
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);
  });

  it("wasm backend: furnsh({ path, bytes }) + kernel APIs", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    expect(() => backend.furnsh({ path: "../naif0012.tls", bytes: lskBytes })).toThrow(
      /\.\./, // do not allow path traversal
    );

    // `kernel.path` is treated as a virtual identifier. WASM normalizes it into
    // an absolute `/kernels/...` path (see `resolveKernelPath`).
    backend.furnsh({ path: "./kernels//naif0012.tls", bytes: lskBytes });
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    const first = backend.kdata(0, "ALL");
    expect(first.found).toBe(true);
    if (first.found) {
      expect(typeof first.file).toBe("string");
      expect(first.file).toBe("/kernels/naif0012.tls");
      expect(typeof first.filtyp).toBe("string");
      expect(typeof first.source).toBe("string");
      expect(typeof first.handle).toBe("number");
    }

    backend.unload("/kernels//naif0012.tls");

    // `furnsh(string)` is WASM-FS backed. The kernel file should still exist in
    // the WASM FS after unload, so re-loading by string should work.
    backend.furnsh("kernels/naif0012.tls");
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);
  });
});

describe("time", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  itNode("node backend: str2et/et2utc/timout", async () => {
    const backend = await createBackend({ backend: "node" });
    backend.kclear();
    backend.furnsh(lskPath);

    const et = backend.str2et("2000 JAN 01 12:00:00 TDB");
    expect(Math.abs(et)).toBeLessThan(1); // J2000 epoch

    const utc = backend.et2utc(0, "ISOC", 3);
    expect(utc).toContain("2000-01-01");

    const pic = backend.timout(0, "YYYY-MON-DD HR:MN:SC.### ::TDB");
    expect(pic).toMatch(/^2000-JAN-01 12:00:00\.000/);
  });

  it("wasm backend: str2et/et2utc/timout", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);
    backend.kclear();
    backend.furnsh({ path: "naif0012.tls", bytes: lskBytes });

    const et = backend.str2et("2000 JAN 01 12:00:00 TDB");
    expect(Math.abs(et)).toBeLessThan(1);

    const utc = backend.et2utc(0, "ISOC", 3);
    expect(utc).toContain("2000-01-01");

    const pic = backend.timout(0, "YYYY-MON-DD HR:MN:SC.### ::TDB");
    expect(pic).toMatch(/^2000-JAN-01 12:00:00\.000/);
  });
});
