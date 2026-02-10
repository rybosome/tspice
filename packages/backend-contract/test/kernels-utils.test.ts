import { describe, expect, it } from "vitest";

import { matchesKernelKind } from "@rybosome/tspice-backend-contract";

describe("matchesKernelKind", () => {
  it("treats requested tokens as trim + case-insensitive", () => {
    const requested = new Set([" spk ", "cK"]);

    expect(matchesKernelKind(requested, { file: "a.bsp", filtyp: "SPK" })).toBe(true);
    expect(matchesKernelKind(requested, { file: "a.bc", filtyp: "CK" })).toBe(true);
    expect(matchesKernelKind(requested, { file: "a.tpc", filtyp: "PCK" })).toBe(false);
  });

  it("normalizes the ALL token", () => {
    const requested = new Set([" all "]);

    expect(matchesKernelKind(requested, { file: "a.bsp", filtyp: "SPK" })).toBe(true);
    expect(matchesKernelKind(requested, { file: "a.bc", filtyp: "CK" })).toBe(true);
  });

  it("normalizes TEXT-subtype matching (e.g. LSK)", () => {
    const requested = new Set([" lsk "]);

    expect(matchesKernelKind(requested, { file: "naif0012.tls", filtyp: "TEXT" })).toBe(true);
    expect(matchesKernelKind(requested, { file: "some_kernel.txt", filtyp: "TEXT" })).toBe(false);
  });

  it("ignores empty requested tokens", () => {
    const requested = new Set(["   "]);
    expect(matchesKernelKind(requested, { file: "a.bsp", filtyp: "SPK" })).toBe(false);
  });
});
