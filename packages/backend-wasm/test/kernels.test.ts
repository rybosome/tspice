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
    const ktotalAll = () => backend.ktotal("ALL" as any);

    const before = ktotalAll();
    backend.furnsh({ path: kernelPath, bytes });
    expect(ktotalAll()).toBe(before + 1);

    const info = backend.kinfo("kernels/minimal.tm");
    expect(info.found).toBe(true);
    if (info.found) {
      expect(info.filtyp).toBeTruthy();
      expect(typeof info.handle).toBe("number");
    }

    const totalAll = ktotalAll();
    let sawKernel = false;
    for (let i = 0; i < totalAll; i++) {
      const kd = backend.kdata(i, "ALL" as any);
      expect(kd.found).toBe(true);
      if (!kd.found) continue;
      expect(kd.file).toBeTruthy();
      expect(kd.filtyp).toBeTruthy();

      if (kd.file === kernelPath) {
        sawKernel = true;
      }
    }
    expect(sawKernel).toBe(true);

    expect(backend.ktotal(["META", "TEXT"]))
      .toBe(backend.ktotal("META") + backend.ktotal("TEXT"));

    backend.unload(kernelPath);
    expect(ktotalAll()).toBe(before);
  });

  it("rejects OS/URL-looking string paths (virtual ids only)", async () => {
    const backend = await createWasmBackend();

    expect(() => backend.furnsh("file:///tmp/naif0012.tls")).toThrow(/virtual ids/i);
    expect(() => backend.unload("/var/data/naif0012.tls")).toThrow(/virtual ids/i);
  });
});
