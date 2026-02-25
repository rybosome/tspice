import { describe, expect, it } from "vitest";

describe("@rybosome/tspice-backend-contract", () => {
  it("does not export runtime helpers that now live in @rybosome/tspice-core", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.assertMat3ArrayLike9).toBeUndefined();
    expect(mod.brandMat3RowMajor).toBeUndefined();
    expect(mod.assertSpiceInt32).toBeUndefined();
    expect(mod.assertGetmsgWhich).toBeUndefined();
    expect(mod.normalizeBodItem).toBeUndefined();
    expect(mod.normalizeKindInput).toBeUndefined();
    expect(mod.createSpiceHandleRegistry).toBeUndefined();
  });

  it("continues to export contract constants", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
    const mod = await import(/* @vite-ignore */ specifier);

    expect(mod.SPICE_INT32_MIN).toBe(-2147483648);
    expect(mod.SPICE_INT32_MAX).toBe(2147483647);
    expect(mod.GETMSG_WHICH_VALUES).toEqual(["SHORT", "LONG", "EXPLAIN"]);
  });
});
