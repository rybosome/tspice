import { describe, expect, it } from "vitest";

import {
  matchesKernelKind,
  nativeKindQueryOrNull,
  normalizeKindInput,
} from "@rybosome/tspice-backend-contract";

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

  it("ignores empty-string requested tokens", () => {
    const requested = new Set([""]);
    expect(matchesKernelKind(requested, { file: "a.bsp", filtyp: "SPK" })).toBe(false);
  });

  it("treats unknown kernel.filtyp values as non-matching", () => {
    const requested = new Set(["SPK"]);

    expect(matchesKernelKind(requested, { file: "a.unknown", filtyp: "WAT" })).toBe(false);
    expect(matchesKernelKind(requested, { file: "a.unknown", filtyp: "UNKNOWN" })).toBe(false);
    expect(matchesKernelKind(new Set(["TEXT"]), { file: "a.tls", filtyp: "WAT" })).toBe(false);
  });

  it("treats unknown requested tokens as non-matching (lenient)", () => {
    expect(matchesKernelKind(new Set(["wat"]), { file: "a.bsp", filtyp: "SPK" })).toBe(false);
    expect(matchesKernelKind(new Set(["wat", "spk"]), { file: "a.bsp", filtyp: "SPK" })).toBe(true);
  });
});


describe("nativeKindQueryOrNull", () => {
  it("treats ALL as an override", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["ALL", "SPK"]))).toBe("ALL");
  });

  it("deduplicates while preserving first-occurrence order", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["CK", "SPK", "CK", "SPK"]))).toBe("CK SPK");
  });

  it("returns null for TEXT subtypes unless TEXT is also requested", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["LSK"]))).toBeNull();
    expect(nativeKindQueryOrNull(normalizeKindInput(["SPK", "LSK"]))).toBeNull();

    expect(nativeKindQueryOrNull(normalizeKindInput(["TEXT", "LSK"]))).toBe("TEXT");
    expect(nativeKindQueryOrNull(normalizeKindInput(["LSK", "TEXT"]))).toBe("TEXT");
  });

  it("supports whitespace-separated kind strings via normalizeKindInput", () => {
    const kinds = normalizeKindInput("  spk   ck ");
    expect(nativeKindQueryOrNull(kinds)).toBe("SPK CK");
  });

  it("is defensive for non-normalized inputs (returns null instead of throwing)", () => {
    expect(nativeKindQueryOrNull([])).toBeNull();
    expect(nativeKindQueryOrNull(["ALL", "SPK"]))
      .toBeNull();
  });
});
