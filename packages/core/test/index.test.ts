import { describe, expect, it } from "vitest";

import { assertNever, invariant, normalizeVirtualKernelPath } from "@rybosome/tspice-core";

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
    expect(() => normalizeVirtualKernelPath("/kernels")).toThrow("Invalid kernel path");
    expect(() => normalizeVirtualKernelPath("kernels")).toThrow("Invalid kernel path");
  });
});
