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
    ).toThrow(/method\.defaults\.compare has unknown key: "nope"/);
  });

  it("rejects unknown method.defaults keys with allowed key hints", () => {
    expect(() =>
      parseMethodSpec({
        sourcePath: "/tmp/method.yml",
        data: {
          id: "methods/time/str2et@v1",
          kind: "method",
          contractMethod: "time.str2et",
          canonicalMethod: "time.str2et",
          defaults: { compar: { tolAbs: 1e-12 } },
          cases: [{ id: "basic", args: ["x"] }],
        },
      }),
    ).toThrow(/method\.defaults has unknown key: "compar" \(allowed keys: "compare"\)/);
  });

  it("rejects unknown method.cases[] keys with allowed key hints", () => {
    expect(() =>
      parseMethodSpec({
        sourcePath: "/tmp/method.yml",
        data: {
          id: "methods/time/str2et@v1",
          kind: "method",
          contractMethod: "time.str2et",
          canonicalMethod: "time.str2et",
          cases: [{ id: "basic", args: ["x"], expec: { ok: true } }],
        },
      }),
    ).toThrow(
      /method\.cases\[0\] has unknown key: "expec" \(allowed keys: "id", "args", "setup", "compare", "expect"\)/,
    );
  });

  it("rejects unknown method.cases[].setup.kernels[] object keys", () => {
    expect(() =>
      parseMethodSpec({
        sourcePath: "/tmp/method.yml",
        data: {
          id: "methods/time/str2et@v1",
          kind: "method",
          contractMethod: "time.str2et",
          canonicalMethod: "time.str2et",
          cases: [
            {
              id: "basic",
              args: ["x"],
              setup: {
                kernels: [{ path: "/tmp/kernels/example.tm", restrictToDIR: "/tmp/kernels" }],
              },
            },
          ],
        },
      }),
    ).toThrow(
      /method\.cases\[0\]\.setup\.kernels\[0\] has unknown key: "restrictToDIR" \(allowed keys: "path", "restrictToDir"\)/,
    );
  });

  it("rejects unknown workflow top-level keys", () => {
    expect(() =>
      parseWorkflowSpec({
        sourcePath: "/tmp/workflow.yml",
        data: {
          id: "workflows/time/common@v1",
          kind: "workflow",
          usess: ["methods/time/str2et@v1"],
        },
      }),
    ).toThrow(/workflow has unknown key: "usess"/);
  });

  it("rejects unknown method top-level keys", () => {
    expect(() =>
      parseMethodSpec({
        sourcePath: "/tmp/method.yml",
        data: {
          id: "methods/time/str2et@v1",
          kind: "method",
          contractMethod: "time.str2et",
          canonicalMethod: "time.str2et",
          canonicalMthod: "time.str2et",
          cases: [{ id: "basic", args: ["x"] }],
        },
      }),
    ).toThrow(/method has unknown key: "canonicalMthod"/);
  });

  it("rejects unknown cross-cutting top-level keys", () => {
    expect(() =>
      parseCrossCuttingSpec({
        sourcePath: "/tmp/cross.yml",
        data: {
          schemaVersion: 1,
          kind: "crossCuttingSpec",
          id: "native-protocol/strict-parsing@v1",
          owner: "parity-checking",
          ownr: "parity-checking",
          cases: [
            {
              id: "rejects-trailing-bytes",
              transport: "native",
              rawRequest: '{"call":"time.str2et","args":["2020-01-01"]}garbage',
              expect: { ok: false, errorCode: "invalid_request" },
            },
          ],
        },
      }),
    ).toThrow(/crossCutting has unknown key: "ownr"/);
  });

  it("rejects unknown cross-cutting cases[] keys", () => {
    expect(() =>
      parseCrossCuttingSpec({
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
              transprt: "native",
              rawRequest: '{"call":"time.str2et","args":["2020-01-01"]}garbage',
              expect: { ok: false, errorCode: "invalid_request" },
            },
          ],
        },
      }),
    ).toThrow(/crossCutting\.cases\[0\] has unknown key: "transprt"/);
  });

  it("rejects unknown cross-cutting expect keys", () => {
    expect(() =>
      parseCrossCuttingSpec({
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
              expect: { ok: false, errorCod: "invalid_request" },
            },
          ],
        },
      }),
    ).toThrow(/crossCutting\.cases\[0\]\.expect has unknown key: "errorCod"/);
  });
});
