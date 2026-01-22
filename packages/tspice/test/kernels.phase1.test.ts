import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lskPath = path.join(__dirname, "fixtures", "kernels", "naif0012.tls");

describe("Phase 1: kernel management", () => {
  const itNode = it.runIf(process.arch !== "arm64");

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

  it("wasm backend: writeFile/loadKernel + kernel APIs", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    // Exercise loadKernel(bareName, data) which prefixes /kernels and creates dirs.
    backend.loadKernel("naif0012.tls", lskBytes);
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    const first = backend.kdata(0, "ALL");
    expect(first.found).toBe(true);
    if (first.found) {
      expect(typeof first.file).toBe("string");
      expect(typeof first.filtyp).toBe("string");
      expect(typeof first.source).toBe("string");
      expect(typeof first.handle).toBe("number");
    }

    backend.unload("/kernels/naif0012.tls");
    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);

    // Exercise FS write + explicit furnsh now that /kernels exists.
    backend.writeFile("/kernels/naif0012.tls", lskBytes);
    backend.furnsh("/kernels/naif0012.tls");
    expect(backend.ktotal("ALL")).toBeGreaterThan(0);

    backend.kclear();
    expect(backend.ktotal("ALL")).toBe(0);
  });
});

describe("Phase 1: time", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend: str2et/et2utc/timout", async () => {
    const backend = await createBackend({ backend: "node" });
    backend.kclear();
    backend.furnsh(lskPath);

    const utcIn = "2000-01-01T12:00:00";
    const etUtc = backend.str2et(utcIn);
    const utcOut = backend.et2utc(etUtc, "ISOC", 3);
    expect(utcOut).toBe("2000-01-01T12:00:00.000");

    // SPICE accepts TDB as a separate token with a space-delimited timestamp.
    const etTdb = backend.str2et("2000-01-01 12:00:00 TDB");
    expect(Math.abs(etTdb)).toBeLessThan(1); // J2000 epoch

    const utc = backend.et2utc(0, "ISOC", 3);
    expect(utc).toContain("2000-01-01");

    const pic = backend.timout(0, "YYYY-MON-DD HR:MN:SC.### ::TDB");
    expect(pic).toMatch(/^2000-JAN-01 12:00:00\.000/);
  });

  it("wasm backend: str2et/et2utc/timout", async () => {
    const backend = await createBackend({ backend: "wasm" });
    const lskBytes = fs.readFileSync(lskPath);
    backend.kclear();
    backend.loadKernel("naif0012.tls", lskBytes);

    const utcIn = "2000-01-01T12:00:00";
    const etUtc = backend.str2et(utcIn);
    const utcOut = backend.et2utc(etUtc, "ISOC", 3);
    expect(utcOut).toBe("2000-01-01T12:00:00.000");

    // SPICE accepts TDB as a separate token with a space-delimited timestamp.
    const etTdb = backend.str2et("2000-01-01 12:00:00 TDB");
    expect(Math.abs(etTdb)).toBeLessThan(1);

    const utc = backend.et2utc(0, "ISOC", 3);
    expect(utc).toContain("2000-01-01");

    const pic = backend.timout(0, "YYYY-MON-DD HR:MN:SC.### ::TDB");
    expect(pic).toMatch(/^2000-JAN-01 12:00:00\.000/);
  });
});
