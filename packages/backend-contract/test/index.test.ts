import { describe, expect, it } from "vitest";

describe("@rybosome/tspice-backend-contract", () => {
  it("exports Mat3 branding + validation helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.brandMat3RowMajor).toBeTypeOf("function");
    expect(mod.brandMat3ColMajor).toBeTypeOf("function");
    expect(mod.assertMat3ArrayLike9).toBeTypeOf("function");
    expect(mod.isMat3ArrayLike9).toBeTypeOf("function");

    const m = mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as const, { freeze: "never" });
    expect(mod.isBrandedMat3RowMajor(m)).toBe(true);
    expect(mod.isBrandedMat3ColMajor(m)).toBe(false);
    expect(mod.isMat3ArrayLike9(m)).toBe(true);

    expect(() => mod.brandMat3RowMajor([1, 2, 3] as unknown)).toThrow(/length-9/i);
    expect(() => mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, Infinity] as unknown)).toThrow(/finite/i);
  });

  it("exports Vec/Mat6 branding + validation helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
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

    expect(() => mod.brandVec3([1, 2] as unknown)).toThrow(/length-3/i);
    expect(() => mod.brandVec3([1, 2, Infinity] as unknown)).toThrow(/finite/i);
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
    expect(() => mod.brandMat6RowMajor(Array.from({ length: 35 }, () => 0) as unknown)).toThrow(/length-36/i);
    expect(() => mod.brandMat6RowMajor([...m36.slice(0, 35), Infinity] as unknown)).toThrow(/finite/i);
  });
});
