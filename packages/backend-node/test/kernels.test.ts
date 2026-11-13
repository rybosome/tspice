import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("@rybosome/tspice-backend-node kernels", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  itNative("kxtrct() trims keywd/terms and rejects empty keywd", () => {
    const backend = createNodeBackend();

    const wordsq = "KEY 1 TERM";

    const baseline = backend.raw.kxtrct("KEY", ["TERM"], wordsq);
    const trimmedInputs = backend.raw.kxtrct(" KEY ", [" TERM "], wordsq);
    expect(trimmedInputs).toEqual(baseline);

    const emptyTerms = backend.raw.kxtrct("KEY", [" ", "TERM", ""], wordsq);
    expect(emptyTerms).toEqual(baseline);

    expect(() => backend.raw.kxtrct("   ", ["TERM"], wordsq)).toThrow(
      /kxtrct keywd must be a non-empty string/i,
    );
  });

  itNative("can furnsh/unload path-backed kernels", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.raw.furnsh(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    backend.raw.unload(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });

  itNative("can furnsh/unload byte-backed kernels via a temp file", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");
    const bytes = fs.readFileSync(fixturePath);

    const kernelPath = "/kernels/minimal.tm";

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.raw.furnsh({ path: kernelPath, bytes });
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    // The contract path is the virtual id; ensure `kinfo()` resolves it.
    const info = backend.raw.kinfo(kernelPath);
    expect(info.found).toBe(true);
    if (info.found) {
      expect(info.filtyp).toBeTruthy();
      expect(typeof info.source).toBe("string");
      expect(typeof info.handle).toBe("number");
    }

    // `kdata()` should map the staged temp file path back to the virtual id.
    const totalAll = backend.raw.ktotal("ALL");
    expect(totalAll).toBeGreaterThan(0);

    let sawVirtual = false;
    for (let i = 0; i < totalAll; i++) {
      const kd = backend.raw.kdata(i, "ALL");
      expect(kd.found).toBe(true);
      if (!kd.found) continue;
      expect(kd.file).toBeTruthy();
      expect(kd.filtyp).toBeTruthy();

      if (kd.file === kernelPath) {
        sawVirtual = true;
      }
    }

    expect(sawVirtual).toBe(true);

    // Array input should behave like an OR of kinds.
    expect(backend.raw.ktotal(["META", "TEXT"])).toBe(
      backend.raw.ktotal("META") + backend.raw.ktotal("TEXT"),
    );

    backend.raw.unload(kernelPath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });
});

describe("native raw kplfrm lifecycle", () => {
  const itNative = it.runIf(nodeAddonAvailable());
  itNative(
    "replaces populated sets, validates capacity/type, and recovers after errors",
    () => {
      const backend = createNodeBackend();
      const ids = backend.kit.newIntCell(4);
      const tiny = backend.kit.newIntCell(0);
      const wrongType = backend.kit.newDoubleCell(4);
      try {
        backend.raw.kclear();
        backend.raw.pipool("FRAME_TSPICE_TEST", [1399001]);
        backend.raw.pcpool("FRAME_1399001_NAME", ["TSPICE_TEST"]);
        backend.raw.pipool("FRAME_1399001_CLASS", [4]);
        backend.raw.insrti(999, ids);
        backend.raw.kplfrm(-1, ids);
        expect(backend.raw.card(ids)).toBe(1);
        expect(backend.kit.cellGeti(ids, 0)).toBe(1399001);
        backend.raw.kplfrm(1, ids);
        expect(backend.raw.card(ids)).toBe(0);
        expect(() => backend.raw.kplfrm(7, ids)).toThrow(/BADFRAMECLASS/);
        expect(backend.raw.failed()).toBe(false);
        expect(() => backend.raw.kplfrm(4, tiny)).toThrow(/SETTOOSMALL/);
        // Contained test-only cast exercises native runtime cell-type validation.
        expect(() =>
          backend.raw.kplfrm(4, wrongType as unknown as typeof ids),
        ).toThrow(/wrong dtype.*SPICE_INT/);
        backend.raw.kplfrm(4, ids);
        expect(backend.raw.card(ids)).toBe(1);
        backend.raw.kclear();
        backend.raw.kplfrm(-1, ids);
        expect(backend.raw.card(ids)).toBe(0);
      } finally {
        backend.raw.kclear();
        backend.kit.freeCell(wrongType);
        backend.kit.freeCell(tiny);
        backend.kit.freeCell(ids);
      }
    },
  );

  itNative("rejects an expired integer-cell handle", () => {
    const backend = createNodeBackend();
    const ids = backend.kit.newIntCell(4);
    backend.kit.freeCell(ids);
    expect(() => backend.raw.kplfrm(4, ids)).toThrow(
      /unknown\/expired SpiceIntCell handle/,
    );
  });
});

describe("native kplfrm argument boundaries", () => {
  const itNative = it.runIf(nodeAddonAvailable());
  itNative(
    "rejects fractional/wrapped handles without mutating a live cell",
    () => {
      const backend = createNodeBackend();
      const ids = backend.kit.newIntCell(4);
      try {
        backend.raw.insrti(999, ids);
        for (const value of [ids + 0.5, ids + 2 ** 32, 0, -1, NaN, Infinity]) {
          // Deliberately forged test-only handle probes runtime validation.
          expect(() => backend.raw.kplfrm(1, value as typeof ids)).toThrow(
            /handle|uint32/,
          );
          expect(backend.raw.card(ids)).toBe(1);
        }
      } finally {
        backend.kit.freeCell(ids);
      }
    },
  );
  itNative(
    "rejects non-integral or overflowing frame classes before CSPICE",
    () => {
      const backend = createNodeBackend();
      const ids = backend.kit.newIntCell(4);
      try {
        for (const value of [4.5, NaN, Infinity, 2 ** 32 + 4])
          expect(() => backend.raw.kplfrm(value, ids)).toThrow(
            /safe integer|32-bit signed integer/,
          );
      } finally {
        backend.kit.freeCell(ids);
      }
    },
  );
});
