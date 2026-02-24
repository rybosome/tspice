import { describe, expect, it } from "vitest";

import { createFakeBackend } from "@rybosome/tspice-backend-fake";

describe("fake backend ids/names item normalization", () => {
  it("uses ASCII trim + ASCII-only uppercase for bodfnd/bodvar (and does not trim NBSP)", () => {
    const b = createFakeBackend();

    b.raw.kclear();
    b.raw.pdpool("BODY399_RADII", [1, 2, 3]);
    b.raw.pcpool("BODY399_FOO", ["bar"]);

    expect(b.raw.bodfnd(399, "RADII")).toBe(true);
    expect(b.raw.bodvar(399, "RADII")).toEqual([1, 2, 3]);

    expect(b.raw.bodfnd(399, "  radii  ")).toBe(true);
    expect(b.raw.bodvar(399, "  radii  ")).toEqual([1, 2, 3]);

    expect(b.raw.bodfnd(399, "\t\n radii \r")).toBe(true);
    expect(b.raw.bodvar(399, "\t\n radii \r")).toEqual([1, 2, 3]);

    expect(b.raw.bodfnd(399, "\u00a0radii\u00a0")).toBe(false);
    expect(b.raw.bodvar(399, "\u00a0radii\u00a0")).toEqual([]);

    // `bodfnd()` is a strict presence check: it returns true even for
    // character-typed BODY<ID>_<ITEM> vars (while `bodvar()` remains numeric-only).
    expect(b.raw.bodfnd(399, "FOO")).toBe(true);
    expect(b.raw.bodvar(399, "FOO")).toEqual([]);
  });
});
