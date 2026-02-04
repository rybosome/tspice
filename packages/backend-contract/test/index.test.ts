import { describe, expect, it } from "vitest";

describe("@rybosome/tspice-backend-contract", () => {
  it("exports Mat3 branding + validation helpers at runtime", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.brandMat3RowMajor).toBeTypeOf("function");
    expect(mod.brandMat3ColMajor).toBeTypeOf("function");
    expect(mod.assertMat3ArrayLike9).toBeTypeOf("function");

    const m = mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1] as const, { freeze: "never" });
    expect(mod.isMat3RowMajor(m)).toBe(true);
    expect(mod.isMat3ColMajor(m)).toBe(false);

    expect(() => mod.brandMat3RowMajor([1, 2, 3] as unknown)).toThrow(/length-9/i);
    expect(() => mod.brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, Infinity] as unknown)).toThrow(/finite/i);
  });
});
