import { describe, expect, it } from "vitest";

import { mergeCompareChain, mergeSetupChain } from "../../src/dsl/mergeResolvedSpec.js";

describe("merge semantics", () => {
  it("merges compare options with later overrides", () => {
    const merged = mergeCompareChain([
      { tolAbs: 1e-12, tolRel: 1e-12, errorShort: false },
      { tolAbs: 1e-9 },
      { errorShort: true },
    ]);

    expect(merged).toEqual({
      tolAbs: 1e-9,
      tolRel: 1e-12,
      errorShort: true,
    });
  });

  it("deduplicates setup kernels deterministically", () => {
    const merged = mergeSetupChain([
      { kernels: ["a", "b"] },
      { kernels: ["b", "c"] },
    ]);

    expect(merged).toEqual({ kernels: ["a", "b", "c"] });
  });
});
