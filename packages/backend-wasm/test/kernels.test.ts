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

    expect(backend.raw.ktotal(["META", "TEXT"])).toBe(
      backend.raw.ktotal("META") + backend.raw.ktotal("TEXT"),
    );

    backend.raw.unload(kernelPath);
    expect(ktotalAll()).toBe(before);
  });

  it("kplfrm replaces integer sets, handles all/inertial classes, and recovers from errors", async () => {
    const backend = await createWasmBackend();
    const idset = backend.kit.newIntCell(4);
    const tiny = backend.kit.newIntCell(0);
    const wrongType = backend.kit.newDoubleCell(4);
    try {
      backend.raw.kclear();
      backend.raw.pipool("FRAME_TSPICE_TEST", [1399001]);
      backend.raw.pcpool("FRAME_1399001_NAME", ["TSPICE_TEST"]);
      backend.raw.pipool("FRAME_1399001_CLASS", [4]);
      backend.raw.pipool("FRAME_TSPICE_OTHER", [-123]);
      backend.raw.pcpool("FRAME_-123_NAME", ["TSPICE_OTHER"]);
      backend.raw.pipool("FRAME_-123_CLASS", [3]);
      backend.raw.insrti(999, idset);
      backend.raw.kplfrm(-1, idset);
      expect(backend.raw.card(idset)).toBe(2);
      expect([
        backend.kit.cellGeti(idset, 0),
        backend.kit.cellGeti(idset, 1),
      ]).toEqual([-123, 1399001]);
      backend.raw.kplfrm(4, idset);
      expect(backend.raw.card(idset)).toBe(1);
      expect(backend.kit.cellGeti(idset, 0)).toBe(1399001);
      backend.raw.kplfrm(1, idset);
      expect(backend.raw.card(idset)).toBe(0);
      expect(() => backend.raw.kplfrm(7, idset)).toThrow(/BADFRAMECLASS/);
      expect(backend.raw.failed()).toBe(false);
      expect(() => backend.raw.kplfrm(4, tiny)).toThrow(/SETTOOSMALL/);
      // A contained test-only cast deliberately exercises runtime handle typing.
      expect(() =>
        backend.raw.kplfrm(4, wrongType as unknown as typeof idset),
      ).toThrow(/SPICE_INT/);
      backend.raw.kplfrm(4, idset);
      expect(backend.raw.card(idset)).toBe(1);
      backend.raw.kclear();
      backend.raw.kplfrm(-1, idset);
      expect(backend.raw.card(idset)).toBe(0);
    } finally {
      backend.raw.kclear();
      backend.kit.freeCell(idset);
      backend.kit.freeCell(tiny);
      backend.kit.freeCell(wrongType);
    }
  });

  it("kplfrm rejects expired and foreign module cell handles", async () => {
    const backend = await createWasmBackend();
    const owner = await createWasmBackend();
    const foreign = owner.kit.newIntCell(4);
    try {
      expect(() => backend.raw.kplfrm(4, foreign)).toThrow(
        /unknown\/expired WASM cell handle/,
      );
    } finally {
      owner.kit.freeCell(foreign);
    }
    const expired = backend.kit.newIntCell(4);
    backend.kit.freeCell(expired);
    expect(() => backend.raw.kplfrm(4, expired)).toThrow(
      /unknown\/expired WASM cell handle/,
    );
  });

  it("kplfrm rejects non-integral or overflowing frame classes before CSPICE", async () => {
    const backend = await createWasmBackend();
    const ids = backend.kit.newIntCell(4);
    try {
      for (const value of [4.5, NaN, Infinity, 2 ** 32 + 4])
        expect(() => backend.raw.kplfrm(value, ids)).toThrow(
          /safe integer|32-bit signed integer/,
        );
    } finally {
      backend.kit.freeCell(ids);
    }
  });
  it("rejects OS/URL-looking string paths (virtual ids only)", async () => {
    const backend = await createWasmBackend();

    expect(() => backend.raw.furnsh("file:///tmp/naif0012.tls")).toThrow(
      /virtual ids/i,
    );
    expect(() => backend.raw.unload("/var/data/naif0012.tls")).toThrow(
      /virtual ids/i,
    );
  });
});
