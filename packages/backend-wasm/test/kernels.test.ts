import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("@rybosome/tspice-backend-wasm kernels", () => {
  it("can furnsh/unload byte-backed kernels via the emscripten FS", async () => {
    const backend = await createWasmBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");
    const bytes = fs.readFileSync(fixturePath);

    const kernelPath = "/kernels/minimal.tm";

    // NOTE: SPICE supports the special kernel kind "ALL", but our public backend
    // contract intentionally does not expose it.
    const ktotalAll = () => backend.raw.ktotal("ALL" as any);

    const before = ktotalAll();
    backend.raw.furnsh({ path: kernelPath, bytes });
    expect(ktotalAll()).toBe(before + 1);

    const info = backend.raw.kinfo("kernels/minimal.tm");
    expect(info.found).toBe(true);
    if (info.found) {
      expect(info.filtyp).toBeTruthy();
      expect(typeof info.handle).toBe("number");
    }

    const totalAll = ktotalAll();
    let sawKernel = false;
    for (let i = 0; i < totalAll; i++) {
      const kd = backend.raw.kdata(i, "ALL" as any);
      expect(kd.found).toBe(true);
      if (!kd.found) continue;
      expect(kd.file).toBeTruthy();
      expect(kd.filtyp).toBeTruthy();

      if (kd.file === kernelPath) {
        sawKernel = true;
      }
    }
    expect(sawKernel).toBe(true);

    expect(backend.raw.ktotal(["META", "TEXT"]))
      .toBe(backend.raw.ktotal("META") + backend.raw.ktotal("TEXT"));

    backend.raw.unload(kernelPath);
    expect(ktotalAll()).toBe(before);
  });

  it("throws for kplfrm until the WASM export is implemented", async () => {
    const backend = await createWasmBackend();

    const idset = backend.kit.newIntCell(4);

    try {
      backend.raw.insrti(1, idset);
      backend.raw.insrti(2, idset);
      expect(backend.raw.card(idset)).toBe(2);

      expect(() => backend.raw.kplfrm(1, idset)).toThrow(/kplfrm.*not supported/i);
      expect(() => backend.raw.kplfrm(1, idset)).toThrow(/hint:.*node backend/i);

      // Ensure we don't silently clear/modify the output set.
      expect(backend.raw.card(idset)).toBe(2);
    } finally {
      backend.kit.freeCell(idset);
    }
  });

  it("rejects OS/URL-looking string paths (virtual ids only)", async () => {
    const backend = await createWasmBackend();

    expect(() => backend.raw.furnsh("file:///tmp/naif0012.tls")).toThrow(RangeError);
    expect(() => backend.raw.furnsh("file:///tmp/naif0012.tls")).toThrow(/Expected:.*virtual ids/i);
    expect(() => backend.raw.unload("/var/data/naif0012.tls")).toThrow(RangeError);
    expect(() => backend.raw.unload("/var/data/naif0012.tls")).toThrow(/Expected:.*virtual ids/i);
  });
});
