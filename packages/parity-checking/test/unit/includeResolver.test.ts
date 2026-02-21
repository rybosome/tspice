import { describe, expect, it } from "vitest";

import { resolveMethodIncludes } from "../../src/dsl/resolveIncludes.js";

import type { MethodSpec, WorkflowSpec } from "../../src/dsl/types.js";

function workflow(id: string, uses: string[] = []): WorkflowSpec {
  return {
    id,
    kind: "workflow",
    uses,
    meta: { sourcePath: `/tmp/${id}.yml` },
  };
}

function method(uses: string[]): MethodSpec {
  return {
    id: "methods/time/str2et@v1",
    kind: "method",
    contractMethod: "time.str2et",
    canonicalMethod: "time.str2et",
    uses,
    cases: [{ id: "case-0", args: [] }],
    meta: { sourcePath: "/tmp/method.yml" },
  };
}

describe("resolveMethodIncludes", () => {
  it("resolves includes in deterministic declaration order", () => {
    const index = new Map<string, WorkflowSpec>([
      ["workflows/a@v1", workflow("workflows/a@v1", ["workflows/c@v1"])],
      ["workflows/b@v1", workflow("workflows/b@v1")],
      ["workflows/c@v1", workflow("workflows/c@v1")],
    ]);

    const out = resolveMethodIncludes(method(["workflows/a@v1", "workflows/b@v1"]), index);
    expect(out.map((entry) => entry.id)).toEqual(["workflows/c@v1", "workflows/a@v1", "workflows/b@v1"]);
  });

  it("fails with actionable include depth error", () => {
    const index = new Map<string, WorkflowSpec>();
    for (let i = 0; i < 10; i++) {
      const current = `workflows/w${i}@v1`;
      const next = `workflows/w${i + 1}@v1`;
      index.set(current, workflow(current, i < 9 ? [next] : []));
    }

    expect(() => resolveMethodIncludes(method(["workflows/w0@v1"]), index)).toThrow(
      /Update MAX_INCLUDE_DEPTH in packages\/parity-checking\/src\/config\/constants.ts/,
    );
  });

  it("fails on include cycles", () => {
    const index = new Map<string, WorkflowSpec>([
      ["workflows/a@v1", workflow("workflows/a@v1", ["workflows/b@v1"])],
      ["workflows/b@v1", workflow("workflows/b@v1", ["workflows/a@v1"])],
    ]);

    expect(() => resolveMethodIncludes(method(["workflows/a@v1"]), index)).toThrow(/Include cycle detected/);
  });
});
