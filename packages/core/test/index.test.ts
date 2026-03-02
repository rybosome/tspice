import { describe, expect, it } from "vitest";

import {
  assertGetmsgWhich,
  assertNever,
  createSpiceHandleRegistry,
  invariant,
  matchesKernelKind,
  nativeKindQueryOrNull,
  normalizeKindInput,
  normalizeVirtualKernelPath,
} from "@rybosome/tspice-core";

describe("@rybosome/tspice-core", () => {
  it("throws when condition is false", () => {
    expect(() => invariant(false)).toThrow("Invariant violation");
  });

  it("throws for assertNever", () => {
    expect(() => assertNever("nope" as never)).toThrow("Unexpected value");
  });

  it("normalizes flexible virtual kernel path forms", () => {
    expect(normalizeVirtualKernelPath("/kernels//naif0012.tls")).toBe("naif0012.tls");

    // Guard against the prefix-only edge case.
    expect(() => normalizeVirtualKernelPath("/kernels")).toThrow(RangeError);
    expect(() => normalizeVirtualKernelPath("/kernels")).toThrow("Invalid kernel path");
    expect(() => normalizeVirtualKernelPath("kernels")).toThrow("Invalid kernel path");
    expect(() => normalizeVirtualKernelPath(123 as unknown as string)).toThrow(TypeError);
  });

  it("normalizes getmsg(which) validation errors", () => {
    expect(() => assertGetmsgWhich("NOPE")).toThrow(TypeError);
    expect(() => assertGetmsgWhich("NOPE")).toThrow(/Expected: one of/i);
    expect(() => assertGetmsgWhich("NOPE")).toThrow(/Got:/i);
  });

  it("exports Mat3 branding + validation helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-core";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.brandMat3RowMajor).toBeTypeOf("function");
    expect(mod.brandMat3ColMajor).toBeTypeOf("function");
    expect(mod.assertMat3ArrayLike9).toBeTypeOf("function");
    expect(mod.isMat3ArrayLike9).toBeTypeOf("function");

    const m = mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as const, { freeze: "never" });
    expect(mod.isBrandedMat3RowMajor(m)).toBe(true);
    expect(mod.isBrandedMat3ColMajor(m)).toBe(false);
    expect(mod.isMat3ArrayLike9(m)).toBe(true);

    expect(() => mod.brandMat3RowMajor([1, 2, 3] as unknown)).toThrow(TypeError);
    expect(() => mod.brandMat3RowMajor([1, 2, 3] as unknown)).toThrow(/length-9/i);
    expect(() => mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, Infinity] as unknown)).toThrow(RangeError);
    expect(() => mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, Infinity] as unknown)).toThrow(/finite/i);
  });

  it("exports Vec/Mat6 branding + validation helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-core";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.brandVec3).toBeTypeOf("function");
    expect(mod.assertVec3ArrayLike3).toBeTypeOf("function");
    expect(mod.isVec3ArrayLike3).toBeTypeOf("function");
    expect(mod.brandVec6).toBeTypeOf("function");
    expect(mod.assertVec6ArrayLike6).toBeTypeOf("function");
    expect(mod.isVec6ArrayLike6).toBeTypeOf("function");

    const v3 = mod.brandVec3(new Float64Array([1, 2, 3]), { freeze: "never" });
    expect(mod.isBrandedVec3(v3)).toBe(true);
    expect(mod.isBrandedVec6(v3)).toBe(false);
    expect(mod.isVec3ArrayLike3(v3)).toBe(true);
    expect(mod.isBrandedVec3(new Float64Array([1, 2, 3]))).toBe(false);

    expect(() => mod.brandVec3([1, 2] as unknown)).toThrow(TypeError);
    expect(() => mod.brandVec3([1, 2] as unknown)).toThrow(/length-3/i);
    expect(() => mod.brandVec3([1, 2, Infinity] as unknown)).toThrow(RangeError);
    expect(() => mod.brandVec3([1, 2, Infinity] as unknown)).toThrow(/finite/i);
    expect(() => mod.brandVec3(new DataView(new ArrayBuffer(24)) as unknown)).toThrow(TypeError);
    expect(() => mod.brandVec3(new DataView(new ArrayBuffer(24)) as unknown)).toThrow(/DataView/i);

    const v6 = mod.brandVec6([1, 2, 3, 4, 5, 6], { freeze: "never" });
    expect(mod.isBrandedVec6(v6)).toBe(true);

    expect(mod.brandMat6RowMajor).toBeTypeOf("function");
    expect(mod.assertMat6ArrayLike36).toBeTypeOf("function");
    expect(mod.isMat6ArrayLike36).toBeTypeOf("function");

    const m36 = Array.from({ length: 36 }, (_, i) => i);
    const m6 = mod.brandMat6RowMajor(m36, { freeze: "never" });
    expect(mod.isBrandedMat6RowMajor(m6)).toBe(true);
    expect(mod.isMat6ArrayLike36(m6)).toBe(true);
    expect(() => mod.brandMat6RowMajor(Array.from({ length: 35 }, () => 0) as unknown)).toThrow(TypeError);
    expect(() => mod.brandMat6RowMajor(Array.from({ length: 35 }, () => 0) as unknown)).toThrow(/length-36/i);
    expect(() => mod.brandMat6RowMajor([...m36.slice(0, 35), Infinity] as unknown)).toThrow(RangeError);
    expect(() => mod.brandMat6RowMajor([...m36.slice(0, 35), Infinity] as unknown)).toThrow(/finite/i);
  });

  it("exports ids/names normalization helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-core";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.normalizeBodItem).toBeTypeOf("function");
    expect(mod.normalizeBodItem("  radii  ")).toBe("RADII");
    expect(mod.normalizeBodItem("\t\n radii \r")).toBe("RADII");

    // Non-ASCII whitespace is intentionally *not* trimmed.
    expect(mod.normalizeBodItem("\u00a0radii\u00a0")).toBe("\u00a0RADII\u00a0");

    // Defensive guardrail: reject pathological inputs to avoid huge allocations / CPU.
    const long = "a".repeat(100_000);
    expect(() => mod.normalizeBodItem(long)).toThrow(/too long/i);
    expect(mod.normalizeBodItem("  ß  ")).toBe("ß");
  });

  it("returns defensive read-only snapshots from internal __entries", () => {
    const registry = createSpiceHandleRegistry();
    const handle = registry.register("EK", 42);
    const entriesHook = (
      registry as unknown as {
        __entries?: () => ReadonlyArray<readonly [unknown, Readonly<{ kind: string; nativeHandle: number }>]>
      }
    ).__entries;

    const entriesA = entriesHook?.() ?? [];
    expect(entriesA).toHaveLength(1);
    const [snapHandleA, snapEntryA] = entriesA[0]!;
    expect(snapHandleA).toBe(handle);
    expect(snapEntryA).toEqual({ kind: "EK", nativeHandle: 42 });
    expect(Object.isFrozen(snapEntryA)).toBe(true);

    expect(() => {
      (snapEntryA as { nativeHandle: number }).nativeHandle = 99;
    }).toThrow(TypeError);

    const entriesB = entriesHook?.() ?? [];
    const snapEntryB = entriesB[0]?.[1];
    expect(snapEntryB).toEqual({ kind: "EK", nativeHandle: 42 });
    expect(snapEntryB).not.toBe(snapEntryA);
  });
});


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


describe("normalizeKindInput", () => {
  it("throws RangeError for empty arrays", () => {
    expect(() => normalizeKindInput([])).toThrowError(RangeError);
    expect(() => normalizeKindInput([])).toThrowError(/normalizeKindInput\(kind\): Expected: a non-empty array/i);
  });
});


describe("nativeKindQueryOrNull", () => {
  it("forwards allowlisted kind queries", () => {
    expect(nativeKindQueryOrNull(["SPK", "CK"])).toBe("SPK CK");
  });

  it("treats ALL as an override", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["ALL", "SPK"]))).toBe("ALL");
  });

  it("deduplicates while preserving first-occurrence order", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["CK", "SPK", "CK", "SPK"]))).toBe("CK SPK");
  });

  it("returns null for TEXT subtypes unless TEXT is also requested", () => {
    expect(nativeKindQueryOrNull(normalizeKindInput(["LSK"]))).toBeNull();
    expect(nativeKindQueryOrNull(normalizeKindInput(["SPK", "LSK"]))).toBeNull();

    expect(nativeKindQueryOrNull(["FK"])).toBeNull();
    expect(nativeKindQueryOrNull(["IK"])).toBeNull();
    expect(nativeKindQueryOrNull(["SCLK"])).toBeNull();

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
