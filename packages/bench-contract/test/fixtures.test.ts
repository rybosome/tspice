import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPathInside } from "../src/v1/fixtures.js";

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
