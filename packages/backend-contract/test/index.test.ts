import { describe, expect, it } from "vitest";

describe("@rybosome/tspice-backend-contract", () => {
  it("fails when imported at runtime (types-only package)", async () => {
    // This package is intentionally *types only*.
    // Runtime imports should fail loudly to prevent accidental bundling.
    const specifier = "@rybosome/tspice-backend-contract";
    await expect(import(/* @vite-ignore */ specifier)).rejects.toThrow();
  });
});
