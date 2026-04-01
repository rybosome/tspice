import { describe, expect, it } from "vitest";

import { parseMethodSpec } from "../../src/dsl/schemaValidate.js";

function baseSpec(): Record<string, unknown> {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/str2et@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
    },
    workflow: {
      steps: [
        {
          op: "call",
          fn: "time.str2et",
          in: "$args",
        },
      ],
    },
    cases: [
      {
        id: "basic",
        args: ["2010-01-01T00:00:00"],
      },
    ],
  };
}

describe("schema validation (canonical call workflow)", () => {
  it("parses canonical call steps with fn + in", () => {
    const parsed = parseMethodSpec({
      sourcePath: "specs/methods/time/str2et@v3.yml",
      data: baseSpec(),
    });

    expect(parsed.workflow?.steps).toEqual([
      {
        op: "call",
        fn: "time.str2et",
        in: "$args",
      },
    ]);
  });

  it("rejects legacy call authored forms", () => {
    const legacyOps = ["callContract", "spiceCall", "withResource"] as const;

    for (const op of legacyOps) {
      const input = baseSpec();
      (input.workflow as { steps: unknown[] }).steps = [{ op }];

      expect(() =>
        parseMethodSpec({
          sourcePath: `specs/methods/time/${op}@v3.yml`,
          data: input,
        }),
      ).toThrow(/no longer supported/);
    }
  });

  it("hard-fails incomplete or unsupported call definitions", () => {
    const missingFn = baseSpec();
    (missingFn.workflow as { steps: unknown[] }).steps = [{ op: "call", in: "$args" }];

    expect(() =>
      parseMethodSpec({
        sourcePath: "specs/methods/time/missing-fn@v3.yml",
        data: missingFn,
      }),
    ).toThrow(/\.fn/);

    const missingIn = baseSpec();
    (missingIn.workflow as { steps: unknown[] }).steps = [{ op: "call", fn: "time.str2et" }];

    expect(() =>
      parseMethodSpec({
        sourcePath: "specs/methods/time/missing-in@v3.yml",
        data: missingIn,
      }),
    ).toThrow(/\.in is required/);

    const withAs = baseSpec();
    (withAs.workflow as { steps: unknown[] }).steps = [
      {
        op: "call",
        fn: "time.str2et",
        in: "$args",
        as: "result",
      },
    ];

    expect(() =>
      parseMethodSpec({
        sourcePath: "specs/methods/time/with-as@v3.yml",
        data: withAs,
      }),
    ).toThrow(/unknown key: "as"/);

    const withOut = baseSpec();
    (withOut.workflow as { steps: unknown[] }).steps = [
      {
        op: "call",
        fn: "time.str2et",
        in: "$args",
        out: { et: "et" },
      },
    ];

    expect(() =>
      parseMethodSpec({
        sourcePath: "specs/methods/time/with-out@v3.yml",
        data: withOut,
      }),
    ).toThrow(/unknown key: "out"/);
  });
});
