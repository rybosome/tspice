import { describe, expect, it } from "vitest";

import { mergeCompareChain, mergeResolvedMethodSpec, mergeSetupChain } from "../../src/dsl/mergeResolvedSpec.js";

import type { MethodSpec, WorkflowSpec } from "../../src/dsl/types.js";

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

  it("applies include merge order then local method defaults", () => {
    const method: MethodSpec = {
      id: "methods/time/str2et@v1",
      kind: "method",
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
      defaults: { compare: { tolAbs: 1e-9 } },
      cases: [{ id: "case", args: [] }],
      meta: { sourcePath: "/tmp/method.yml" },
    };

    const include: WorkflowSpec = {
      id: "workflows/time/common@v1",
      kind: "workflow",
      compareDefaults: { tolAbs: 1e-12, tolRel: 1e-12 },
      meta: { sourcePath: "/tmp/workflow.yml" },
    };

    const resolved = mergeResolvedMethodSpec(method, [include]);
    expect(resolved.mergedCompareDefaults).toEqual({
      tolAbs: 1e-9,
      tolRel: 1e-12,
    });
  });
});
