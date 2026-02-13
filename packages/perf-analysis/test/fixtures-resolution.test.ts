import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPathInside, resolveFixtureRef } from "../src/shared/fixtures/index.js";

describe("shared/fixtures: resolveFixtureRef()", () => {
  it("selects the first fixture root that contains the target", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-perf-analysis-fixtures-"));

    try {
      const fixtures1 = path.join(tmpRoot, "fixtures1");
      const fixtures2 = path.join(tmpRoot, "fixtures2");
      fs.mkdirSync(fixtures1, { recursive: true });
      fs.mkdirSync(fixtures2, { recursive: true });

      const target = path.join(fixtures2, "k.tls");
      fs.writeFileSync(target, "kernel", "utf8");

      const resolved = resolveFixtureRef(
        { kind: "path", path: "$FIXTURES/k.tls" },
        [fixtures1, fixtures2],
        { baseDir: tmpRoot },
      );

      expect(resolved.path).toBe(target);
      expect(resolved.id).toBe("$FIXTURES/k.tls");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("rejects $FIXTURES refs that attempt to escape their root via ..", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-perf-analysis-fixtures-"));

    try {
      const fixtures = path.join(tmpRoot, "fixtures");
      fs.mkdirSync(fixtures, { recursive: true });

      expect(() =>
        resolveFixtureRef(
          { kind: "path", path: "$FIXTURES/../evil.txt" },
          [fixtures],
          { baseDir: tmpRoot },
        ),
      ).toThrow(/must not escape fixture root/i);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe("shared/fixtures: isPathInside()", () => {
  it("handles win32-style containment including cross-drive escapes", () => {
    const p = path.win32;

    expect(isPathInside("C:\\repo\\fixtures", "C:\\repo\\fixtures\\kernels\\a.tls", { pathImpl: p })).toBe(
      true,
    );

    // Win32 paths are effectively case-insensitive.
    expect(isPathInside("C:\\Repo\\Fixtures", "c:\\repo\\fixtures\\kernels\\a.tls", { pathImpl: p })).toBe(
      true,
    );

    // Similar prefixes should not count as containment.
    expect(isPathInside("C:\\repo\\fixtures", "C:\\repo\\fixtures2\\a.tls", { pathImpl: p })).toBe(false);

    // Different drives should not count as containment.
    expect(isPathInside("C:\\repo\\fixtures", "D:\\repo\\fixtures\\a.tls", { pathImpl: p })).toBe(false);
  });
});
