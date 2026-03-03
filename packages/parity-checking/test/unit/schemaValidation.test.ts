import { describe, expect, it } from "vitest";

import { parseCrossCuttingSpecAny, parseMethodSpecAny } from "../../src/dsl/schemaValidate.js";

describe("schema validation (v3)", () => {
  it("parses valid v3 method spec with workflow+cases", () => {
    const method = parseMethodSpecAny({
      sourcePath: "specs/methods/time/spiceVersion@v3.yml",
      data: {
        schemaVersion: 3,
        manifest: {
          id: "methods/time/spiceVersion@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "time.spiceVersion",
          canonicalMethod: "time.spiceVersion",
        },
        workflow: {
          steps: [{ op: "callContract" }],
        },
        cases: [
          {
            id: "toolkit",
            args: [],
          },
        ],
      },
    });

    expect(method.manifest.id).toBe("methods/time/spiceVersion@v3");
    expect(method.workflow?.steps[0]?.op).toBe("callContract");
    expect(method.cases).toHaveLength(1);
  });

  it("parses valid v3 method spec with suites[]", () => {
    const method = parseMethodSpecAny({
      sourcePath: "specs/methods/time/suites-sample@v3.yml",
      data: {
        schemaVersion: 3,
        manifest: {
          id: "methods/time/suites-sample@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "time.spiceVersion",
          canonicalMethod: "time.spiceVersion",
        },
        suites: [
          {
            id: "default",
            workflow: {
              steps: [{ op: "callContract" }],
            },
            cases: [{ id: "ok", args: [] }],
          },
        ],
      },
    });

    expect(method.suites).toHaveLength(1);
    expect(method.workflow).toBeUndefined();
    expect(method.cases).toBeUndefined();
  });

  it("rejects methods that define both workflow and suites", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "specs/methods/time/invalid-both@v3.yml",
        data: {
          schemaVersion: 3,
          manifest: {
            id: "methods/time/invalid-both@v3",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
          },
          workflow: {
            steps: [{ op: "callContract" }],
          },
          cases: [{ id: "ok", args: [] }],
          suites: [
            {
              id: "dup",
              workflow: {
                steps: [{ op: "callContract" }],
              },
              cases: [{ id: "ok", args: [] }],
            },
          ],
        },
      }),
    ).toThrow(/exactly one of workflow\/cases or suites\[\]/);
  });

  it("rejects authored lifecycle ops outside withResource", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "specs/methods/dsk/invalid-lifecycle@v3.yml",
        data: {
          schemaVersion: 3,
          manifest: {
            id: "methods/dsk/invalid-lifecycle@v3",
            kind: "method",
          },
          contract: {
            contractMethod: "dsk.dskgd",
            canonicalMethod: "dsk.dskgd",
          },
          workflow: {
            steps: [
              {
                op: "dasOpen",
                path: "$refs.path",
                as: "handle",
              },
            ],
          },
          cases: [{ id: "invalid", args: {} }],
        },
      }),
    ).toThrow(/use withResource instead/);
  });

  it("rejects script.language and disallowed script imports", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "specs/methods/time/invalid-script-language@v3.yml",
        data: {
          schemaVersion: 3,
          manifest: {
            id: "methods/time/invalid-script-language@v3",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
          },
          workflow: {
            steps: [
              {
                op: "script",
                language: "javascript",
                code: "return 1;",
              },
            ],
          },
          cases: [{ id: "invalid", args: [] }],
        },
      }),
    ).toThrow(/script implies TypeScript/);

    expect(() =>
      parseMethodSpecAny({
        sourcePath: "specs/methods/time/invalid-script-import@v3.yml",
        data: {
          schemaVersion: 3,
          manifest: {
            id: "methods/time/invalid-script-import@v3",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
          },
          workflow: {
            steps: [
              {
                op: "script",
                code: "import fs from 'node:fs'; return 1;",
              },
            ],
          },
          cases: [{ id: "invalid", args: [] }],
        },
      }),
    ).toThrow(/module imports are not allowed/);
  });

  it("parses valid v3 cross-cutting spec", () => {
    const spec = parseCrossCuttingSpecAny({
      sourcePath: "specs/cross-cutting/native-protocol/strict-parsing@v3.yml",
      data: {
        schemaVersion: 3,
        manifest: {
          id: "native-protocol/strict-parsing@v3",
          kind: "crossCuttingSpec",
        },
        cases: [
          {
            id: "rejects-trailing-bytes",
            transport: "native",
            rawRequest: '{"call":"time.str2et","args":["2020-01-01"]}garbage',
            expect: {
              ok: false,
              errorCode: "invalid_request",
            },
          },
        ],
      },
    });

    expect(spec.manifest.id).toContain("strict-parsing@v3");
    expect(spec.cases).toHaveLength(1);
  });
});
