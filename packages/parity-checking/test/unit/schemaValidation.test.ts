import { describe, expect, it } from "vitest";

import {
  parseCrossCuttingSpec,
  parseMethodSpec,
  parseWorkflowSpec,
} from "../../src/dsl/schemaValidate.js";

describe("schema validation", () => {
  it("parses valid workflow/method/cross-cutting specs", () => {
    const workflow = parseWorkflowSpec({
      sourcePath: "/tmp/workflow.yml",
      data: {
        id: "workflows/time/common@v1",
        kind: "workflow",
        compareDefaults: { tolAbs: 1e-12 },
      },
    });

    const method = parseMethodSpec({
      sourcePath: "/tmp/method.yml",
      data: {
        id: "methods/time/str2et@v1",
        kind: "method",
        contractMethod: "time.str2et",
        canonicalMethod: "time.str2et",
        cases: [{ id: "basic", args: ["2000 JAN 01 12:00:00 TDB"], expect: { ok: true } }],
      },
    });

    const cross = parseCrossCuttingSpec({
      sourcePath: "/tmp/cross.yml",
      data: {
        schemaVersion: 1,
        kind: "crossCuttingSpec",
        id: "native-protocol/strict-parsing@v1",
        owner: "parity-checking",
        cases: [
          {
            id: "rejects-trailing-bytes",
            transport: "native",
            rawRequest: '{"call":"time.str2et","args":["2020-01-01"]}garbage',
            expect: { ok: false, errorCode: "invalid_request" },
          },
        ],
      },
    });

    expect(workflow.kind).toBe("workflow");
    expect(method.kind).toBe("method");
    expect(cross.kind).toBe("crossCuttingSpec");
  });

  it("rejects unknown compare keys", () => {
    expect(() =>
      parseMethodSpec({
        sourcePath: "/tmp/method.yml",
        data: {
          id: "methods/time/str2et@v1",
          kind: "method",
          contractMethod: "time.str2et",
          canonicalMethod: "time.str2et",
          defaults: { compare: { nope: 1 } },
          cases: [{ id: "basic", args: ["x"] }],
        },
      }),
    ).toThrow(/unknown key/);
  });
});
