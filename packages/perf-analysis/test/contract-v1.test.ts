import { describe, expect, it } from "vitest";

import { normalizeFixtureRefs, validate } from "../src/contracts/benchmark-contract/v1/index.js";

describe("benchmark-contract v1: validate()", () => {
  it("rejects unknown top-level keys", () => {
    expect(() =>
      validate({
        version: 1,
        benchmarks: [],
        extra: true,
      }),
    ).toThrow(/unknown top-level keys/i);
  });

  it("supports fixture ref shorthands and canonical forms", () => {
    const cases: Array<{ label: string; kernel: unknown; expected: unknown }> = [
      {
        label: "string",
        kernel: "$FIXTURES/a.tm",
        expected: "$FIXTURES/a.tm",
      },
      {
        label: "canonical kind=id",
        kernel: { kind: "id", id: "basic-time" },
        expected: { kind: "id", id: "basic-time" },
      },
      {
        label: "canonical kind=path",
        kernel: { kind: "path", path: "$FIXTURES/a.tm" },
        expected: { kind: "path", path: "$FIXTURES/a.tm" },
      },
      {
        label: "shorthand object {id}",
        kernel: { id: "basic-time" },
        expected: { id: "basic-time" },
      },
      {
        label: "shorthand object {path}",
        kernel: { path: "$FIXTURES/a.tm" },
        expected: { path: "$FIXTURES/a.tm" },
      },
    ];

    for (const c of cases) {
      const out = validate({
        version: 1,
        benchmarks: [{ id: `bench_${c.label}`, kernel: c.kernel }],
      });

      expect(out.benchmarks[0]?.kernel).toEqual(c.expected);
    }
  });

  it("treats null id as explicit invalid input", () => {
    expect(() =>
      validate({
        version: 1,
        benchmarks: [{ id: null }],
      }),
    ).toThrow(/benchmarks\[0\]\.id must be a string \(got null\)/);
  });

  it("rejects null fixture refs (kernel)", () => {
    expect(() =>
      validate({
        version: 1,
        benchmarks: [{ id: "a", kernel: null }],
      }),
    ).toThrow(/benchmarks\[0\]\.kernel must be a string or mapping\/object \(got null\)/);
  });
});

describe("benchmark-contract v1: normalizeFixtureRefs()", () => {
  it("rejects unknown top-level keys (even if validate is bypassed)", () => {
    expect(() =>
      normalizeFixtureRefs({
        version: 1,
        benchmarks: [],
        extra: true,
      } as any),
    ).toThrow(/unknown top-level keys/i);
  });

  it("canonicalizes fixture ref shapes", () => {
    const validated = validate({
      version: 1,
      benchmarks: [
        { id: "a", kernel: "$FIXTURES/a.tm" },
        { id: "b", kernel: { id: "basic-time" } },
        { id: "c", kernel: { kind: "path", path: "$FIXTURES/c.tm" } },
      ],
    });

    const normalized = normalizeFixtureRefs(validated);

    expect(normalized.benchmarks[0]?.kernel).toEqual({ kind: "path", path: "$FIXTURES/a.tm" });
    expect(normalized.benchmarks[1]?.kernel).toEqual({ kind: "id", id: "basic-time" });
    expect(normalized.benchmarks[2]?.kernel).toEqual({ kind: "path", path: "$FIXTURES/c.tm" });
  });
});
