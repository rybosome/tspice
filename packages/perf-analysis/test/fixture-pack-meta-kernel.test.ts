import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveFixtureRef } from "../src/shared/fixtures/index.js";
import { resolveMetaKernelKernelsToLoad } from "../src/runners/node-native/metaKernel.js";

describe("fixture-pack dir alias", () => {
  it("treats a directory fixture as an alias for <dir>/<basename>.tm", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-perf-analysis-fixture-pack-"));

    try {
      const fixturesRoot = path.join(tmpRoot, "fixtures");
      const packDir = path.join(fixturesRoot, "basic-time");
      fs.mkdirSync(packDir, { recursive: true });

      const metaKernelPath = path.join(packDir, "basic-time.tm");
      fs.writeFileSync(metaKernelPath, "\\begindata\nKERNELS_TO_LOAD = ( )\n\\begintext\n", "utf8");

      const resolved = resolveFixtureRef(
        { kind: "path", path: "$FIXTURES/basic-time" },
        [fixturesRoot],
        { baseDir: tmpRoot },
      );

      expect(resolved.path).toBe(metaKernelPath);
      expect(resolved.restrictToDir).toBe(packDir);
      expect(resolved.id).toBe("$FIXTURES/basic-time");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("throws when a fixture-pack directory is missing its meta-kernel", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-perf-analysis-fixture-pack-"));

    try {
      const fixturesRoot = path.join(tmpRoot, "fixtures");
      const packDir = path.join(fixturesRoot, "basic-time");
      fs.mkdirSync(packDir, { recursive: true });

      expect(() =>
        resolveFixtureRef(
          { kind: "path", path: "$FIXTURES/basic-time" },
          [fixturesRoot],
          { baseDir: tmpRoot },
        ),
      ).toThrow(/missing meta-kernel/i);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe("meta-kernel restriction", () => {
  it("prevents KERNELS_TO_LOAD from escaping restrictToDir", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-perf-analysis-meta-kernel-"));

    try {
      const fixturesRoot = path.join(tmpRoot, "fixtures");
      const packDir = path.join(fixturesRoot, "basic-time");
      fs.mkdirSync(packDir, { recursive: true });

      const metaKernelPath = path.join(packDir, "basic-time.tm");
      const evilKernelPath = path.join(fixturesRoot, "evil.tls");
      fs.writeFileSync(evilKernelPath, "evil", "utf8");

      const metaKernelText = [
        "\\begindata",
        "KERNELS_TO_LOAD = (",
        "  '../evil.tls'",
        ")",
        "\\begintext",
        "",
      ].join("\n");

      // metaKernelPath is only used for dirname/resolution + error messages.
      fs.writeFileSync(metaKernelPath, metaKernelText, "utf8");

      expect(() =>
        resolveMetaKernelKernelsToLoad(metaKernelText, metaKernelPath, { restrictToDir: packDir }),
      ).toThrow(/outside of the allowed directory/i);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
