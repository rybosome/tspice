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

    const baseline = backend.kxtrct("KEY", ["TERM"], wordsq);
    const trimmedInputs = backend.kxtrct(" KEY ", [" TERM "], wordsq);
    expect(trimmedInputs).toEqual(baseline);

    const emptyTerms = backend.kxtrct("KEY", [" ", "TERM", ""], wordsq);
    expect(emptyTerms).toEqual(baseline);

    expect(() => backend.kxtrct("   ", ["TERM"], wordsq)).toThrow(/kxtrct keywd must be a non-empty string/i);
  });

  itNative("can furnsh/unload path-backed kernels", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.furnsh(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    backend.unload(fixturePath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });

  itNative("can furnsh/unload byte-backed kernels via a temp file", () => {
    const backend = createNodeBackend();

    const fixturePath = path.join(testDir, "fixtures", "minimal.tm");
    const bytes = fs.readFileSync(fixturePath);

    const kernelPath = "/kernels/minimal.tm";

    const withTesting = backend as typeof backend & { __ktotalAll(): number };
    const before = withTesting.__ktotalAll();

    backend.furnsh({ path: kernelPath, bytes });
    expect(withTesting.__ktotalAll()).toBe(before + 1);

    // The contract path is the virtual id; ensure `kinfo()` resolves it.
    const info = backend.kinfo(kernelPath);
    expect(info.found).toBe(true);
    if (info.found) {
      expect(info.filtyp).toBeTruthy();
      expect(typeof info.source).toBe("string");
      expect(typeof info.handle).toBe("number");
    }

    // `kdata()` should map the staged temp file path back to the virtual id.
    const totalAll = backend.ktotal("ALL");
    expect(totalAll).toBeGreaterThan(0);

    let sawVirtual = false;
    for (let i = 0; i < totalAll; i++) {
      const kd = backend.kdata(i, "ALL");
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
    expect(backend.ktotal(["META", "TEXT"]))
      .toBe(backend.ktotal("META") + backend.ktotal("TEXT"));

    backend.unload(kernelPath);
    expect(withTesting.__ktotalAll()).toBe(before);
  });
});
