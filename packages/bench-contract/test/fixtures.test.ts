import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPathInside, resolveFixtureRef } from "../src/v1/fixtures.js";

describe("isPathInside", () => {
  it("handles posix-style containment", () => {
    const p = path.posix;

    expect(
      isPathInside("/repo/fixtures", "/repo/fixtures/kernels/a.tls", {
        pathImpl: p,
      }),
    ).toBe(true);

    // Trailing separators should not affect containment.
    expect(
      isPathInside("/repo/fixtures/", "/repo/fixtures", { pathImpl: p }),
    ).toBe(true);

    // Similar prefixes should not count as containment.
    expect(
      isPathInside("/repo/fixtures", "/repo/fixtures2/a.tls", { pathImpl: p }),
    ).toBe(false);

    // Path normalization should be applied before containment checks.
    expect(
      isPathInside("/repo/fixtures", "/repo/fixtures/../evil", { pathImpl: p }),
    ).toBe(false);
  });

  it("handles win32-style containment (including case-insensitivity)", () => {
    const p = path.win32;

    expect(
      isPathInside("C:\\repo\\fixtures", "C:\\repo\\fixtures\\kernels\\a.tls", {
        pathImpl: p,
      }),
    ).toBe(true);

    // Win32 paths are effectively case-insensitive.
    expect(
      isPathInside("C:\\Repo\\Fixtures", "c:\\repo\\fixtures\\kernels\\a.tls", {
        pathImpl: p,
      }),
    ).toBe(true);

    // Similar prefixes should not count as containment.
    expect(
      isPathInside("C:\\repo\\fixtures", "C:\\repo\\fixtures2\\a.tls", {
        pathImpl: p,
      }),
    ).toBe(false);

    // Different drives should not count as containment.
    expect(
      isPathInside("C:\\repo\\fixtures", "D:\\repo\\fixtures\\a.tls", {
        pathImpl: p,
      }),
    ).toBe(false);

    // Trailing separators should not affect containment.
    expect(
      isPathInside("C:\\repo\\fixtures\\", "C:\\repo\\fixtures", {
        pathImpl: p,
      }),
    ).toBe(true);
  });
});

describe("resolveFixtureRef", () => {
  it("defaults checkSymlinkContainment to checkExistence (backwards compatible)", () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tspice-bench-contract-fixture-ref-"),
    );

    try {
      const fixturesDir = path.join(repoRoot, "fixtures");
      fs.mkdirSync(fixturesDir, { recursive: true });

      const outsideDir = path.join(repoRoot, "outside");
      fs.mkdirSync(outsideDir, { recursive: true });

      const outsideFile = path.join(outsideDir, "secret.txt");
      fs.writeFileSync(outsideFile, "secret", "utf8");

      const linkPath = path.join(fixturesDir, "escape.txt");
      fs.symlinkSync(outsideFile, linkPath);

      // Previously, `checkExistence: true` implied symlink containment.
      const result = resolveFixtureRef("$FIXTURES/escape.txt", {
        repoRoot,
        fixtureRoots: { FIXTURES: "fixtures" },
        checkExistence: true,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.message).toContain("via symlink");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("enforces symlink containment even when checkExistence is false", () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tspice-bench-contract-fixture-ref-"),
    );

    try {
      const fixturesDir = path.join(repoRoot, "fixtures");
      fs.mkdirSync(fixturesDir, { recursive: true });

      const outsideDir = path.join(repoRoot, "outside");
      fs.mkdirSync(outsideDir, { recursive: true });

      const outsideFile = path.join(outsideDir, "secret.txt");
      fs.writeFileSync(outsideFile, "secret", "utf8");

      const linkPath = path.join(fixturesDir, "escape.txt");
      fs.symlinkSync(outsideFile, linkPath);

      const result = resolveFixtureRef("$FIXTURES/escape.txt", {
        repoRoot,
        fixtureRoots: { FIXTURES: "fixtures" },
        checkExistence: false,
        checkSymlinkContainment: true,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.message).toContain("via symlink");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("can explicitly disable symlink containment even when existence checks are on", () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tspice-bench-contract-fixture-ref-"),
    );

    try {
      const fixturesDir = path.join(repoRoot, "fixtures");
      fs.mkdirSync(fixturesDir, { recursive: true });

      const outsideDir = path.join(repoRoot, "outside");
      fs.mkdirSync(outsideDir, { recursive: true });

      const outsideFile = path.join(outsideDir, "secret.txt");
      fs.writeFileSync(outsideFile, "secret", "utf8");

      const linkPath = path.join(fixturesDir, "escape.txt");
      fs.symlinkSync(outsideFile, linkPath);

      const result = resolveFixtureRef("$FIXTURES/escape.txt", {
        repoRoot,
        fixtureRoots: { FIXTURES: "fixtures" },
        checkExistence: true,
        checkSymlinkContainment: false,
      });

      expect(result.ok).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("fails closed on excessively deep fixture refs", () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tspice-bench-contract-fixture-ref-"),
    );

    try {
      const fixturesDir = path.join(repoRoot, "fixtures");
      fs.mkdirSync(fixturesDir, { recursive: true });

      const deepRelPath = new Array(65).fill("a").join("/");
      const result = resolveFixtureRef(`$FIXTURES/${deepRelPath}`, {
        repoRoot,
        fixtureRoots: { FIXTURES: "fixtures" },
        checkExistence: false,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.message).toContain("too deep");
      expect(result.message).toContain("max 64");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
