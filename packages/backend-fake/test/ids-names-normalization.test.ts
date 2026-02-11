import { describe, expect, it } from "vitest";

import { createFakeBackend } from "@rybosome/tspice-backend-fake";

describe("fake backend ids/names item normalization", () => {
  it("uses ASCII trim + ASCII-only uppercase for bodfnd/bodvar (and does not trim NBSP)", () => {
    const b = createFakeBackend();

    b.kclear();
    b.pdpool("BODY399_RADII", [1, 2, 3]);
    b.pcpool("BODY399_FOO", ["bar"]);

    expect(b.bodfnd(399, "RADII")).toBe(true);
    expect(b.bodvar(399, "RADII")).toEqual([1, 2, 3]);

    expect(b.bodfnd(399, "  radii  ")).toBe(true);
    expect(b.bodvar(399, "  radii  ")).toEqual([1, 2, 3]);

    expect(b.bodfnd(399, "\t\n radii \r")).toBe(true);
    expect(b.bodvar(399, "\t\n radii \r")).toEqual([1, 2, 3]);

    expect(b.bodfnd(399, "\u00a0radii\u00a0")).toBe(false);
    expect(b.bodvar(399, "\u00a0radii\u00a0")).toEqual([]);

    // Character-typed BODY<ID>_<ITEM> vars are treated as a normal miss.
    expect(b.bodfnd(399, "FOO")).toBe(false);
    expect(b.bodvar(399, "FOO")).toEqual([]);
  });
});
