import { describe, expect, it } from "vitest";

import { validateBenchmarkSuiteV1 } from "../src/v1/validate.js";

describe("validateBenchmarkSuiteV1", () => {
  it("rejects empty/absolute fixtureRoots keys and paths", () => {
    const result = validateBenchmarkSuiteV1(
      {
        schemaVersion: 1,
        fixtureRoots: {
          "   ": "relative/path",
          FIXTURES: "   ",
          ABS_POSIX: "/tmp/fixtures",
          ABS_WIN: "C:\\tmp\\fixtures",
        },
        benchmarks: [
          {
            id: "b1",
            kind: "micro",
            cases: [{ call: "noop" }],
          },
        ],
      },
      { repoRoot: process.cwd(), checkFixtureExistence: false },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const messages = result.errors.map((e) => e.message).join("\n");
    expect(messages).toContain("Fixture root names must be non-empty");
    expect(messages).toContain("Fixture root paths must be non-empty");
    expect(messages).toContain("absolute paths are not allowed");
  });

  it("still detects duplicate benchmark ids even when kind is invalid", () => {
    const result = validateBenchmarkSuiteV1(
      {
        schemaVersion: 1,
        benchmarks: [
          // structurally invalid: missing kind
          { id: "dup" },
          // valid benchmark with the same id
          { id: "dup", kind: "micro", cases: [{ call: "noop" }] },
        ],
      },
      { repoRoot: process.cwd(), checkFixtureExistence: false },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const messages = result.errors.map((e) => e.message).join("\n");
    expect(messages).toContain("Benchmark 'kind' must be 'micro' or 'workflow'.");
    expect(messages).toContain("Duplicate benchmark id 'dup'");
  });

  it("does not infinite-loop on cyclic args objects", () => {
    const args: Record<string, unknown> = { a: { $ref: "var.missing" } };
    args.self = args;

    expect(() =>
      validateBenchmarkSuiteV1(
        {
          schemaVersion: 1,
          benchmarks: [
            {
              id: "wf",
              kind: "workflow",
              steps: [{ call: "noop", args }],
            },
          ],
        },
        { repoRoot: process.cwd(), checkFixtureExistence: false },
      ),
    ).not.toThrow();
  });

  it("allows fixture paths that start with '..' but do not traverse", () => {
    const result = validateBenchmarkSuiteV1(
      {
        schemaVersion: 1,
        fixtureRoots: { FIXTURES: "." },
        defaults: {
          setup: {
            kernels: ["$FIXTURES/..evil"],
          },
        },
        benchmarks: [
          {
            id: "b1",
            kind: "micro",
            cases: [{ call: "noop" }],
          },
        ],
      },
      { repoRoot: process.cwd(), checkFixtureExistence: false },
    );

    expect(result.ok).toBe(true);
  });

  it("rejects fixture path traversal using '..' segments", () => {
    const result = validateBenchmarkSuiteV1(
      {
        schemaVersion: 1,
        fixtureRoots: { FIXTURES: "." },
        defaults: {
          setup: {
            kernels: ["$FIXTURES/../evil"],
          },
        },
        benchmarks: [
          {
            id: "b1",
            kind: "micro",
            cases: [{ call: "noop" }],
          },
        ],
      },
      { repoRoot: process.cwd(), checkFixtureExistence: false },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0]?.message).toContain("escapes root");
  });
});
