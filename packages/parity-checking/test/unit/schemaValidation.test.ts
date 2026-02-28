import { describe, expect, it } from "vitest";

import {
  parseCrossCuttingSpecAny,
  parseCrossCuttingSpec,
  parseMethodSpecAny,
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

  it("parses valid v2 method and cross-cutting specs via schemaVersion router", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "methods/cells-windows/newIntCell@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "cells-windows.newIntCell",
          canonicalMethod: "cells-windows.newIntCell",
          args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
          result: {
            type: "object",
            required: ["kind", "size", "card"],
            properties: {
              kind: { const: "int" },
              size: { type: "spiceInt" },
              card: { type: "spiceInt" },
            },
          },
          errors: [{ code: "invalid_args" }],
        },
        workflow: {
          steps: [
            {
              op: "allocCell",
              as: "cell",
              params: { kind: "int", size: "$args.size" },
            },
            {
              op: "spiceCall",
              call: "card_c",
              in: ["$refs.cell"],
              as: "card",
            },
            {
              op: "projectResult",
              out: {
                kind: "int",
                size: "$args.size",
                card: "$refs.card",
              },
            },
          ],
          cleanup: [{ op: "freeCell", target: "$refs.cell" }],
        },
        cases: [{ id: "basic", args: { size: 8 }, expect: { ok: true } }],
      },
    });

    const crossV2 = parseCrossCuttingSpecAny({
      sourcePath: "/tmp/cross-v2.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "native-protocol/strict-parsing@v2",
          kind: "crossCuttingSpec",
        },
        cases: [
          {
            id: "rejects-trailing-bytes",
            transport: "native",
            rawRequest: '{"call":"cells-windows.newIntCell","args":[8]}\\u0000junk',
            expect: { ok: false, errorCode: "invalid_request" },
          },
        ],
      },
    });

    expect(methodV2).toMatchObject({ schemaVersion: 2 });
    expect(crossV2).toMatchObject({ schemaVersion: 2 });
  });

  it("accepts EK workflow spiceCall ops with output refs", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-ekgc.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "method.ek.ekgc@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "ek.ekgc",
          canonicalMethod: "ek.ekgc",
          result: {
            type: "object",
            required: ["found", "isNull", "value"],
            properties: {
              found: { const: true },
              isNull: { const: false },
              value: { const: "ISS_WAC_ShutterBladeBMove" },
            },
          },
        },
        workflow: {
          steps: [
            {
              op: "spiceCall",
              call: "ekgc_c",
              in: [
                "SELECT EVENT FROM CASSINI_NOISE_EVENTS WHERE EVENT = 'ISS_WAC_ShutterBladeBMove'",
                0,
                0,
                0,
              ],
              as: "read",
            },
            {
              op: "projectResult",
              out: {
                found: "$refs.read.found",
                isNull: "$refs.read.isNull",
                value: "$refs.read.value",
              },
            },
          ],
        },
        cases: [{ id: "reads-event", args: {}, expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({ schemaVersion: 2 });
  });

  it("accepts resolveFirstLoadedEkPath workflow ops", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-eknseg-declarative.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "method.ek.eknseg@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "ek.eknseg",
          canonicalMethod: "ek.eknseg",
          result: {
            type: "object",
            required: ["ok", "nseg"],
            properties: {
              ok: { const: true },
              nseg: { const: 1 },
            },
          },
        },
        workflow: {
          steps: [
            {
              op: "resolveFirstLoadedEkPath",
              as: "ekPath",
            },
            {
              op: "spiceCall",
              call: "ekopr_c",
              in: ["$refs.ekPath"],
              as: "handle",
            },
            {
              op: "spiceCall",
              call: "eknseg_c",
              in: ["$refs.handle"],
              as: "nseg",
            },
            {
              op: "projectResult",
              out: {
                ok: true,
                nseg: "$refs.nseg",
              },
            },
          ],
          cleanup: [
            {
              op: "spiceCall",
              call: "ekcls_c",
              in: ["$refs.handle"],
            },
          ],
        },
        cases: [{ id: "reads-segment-count", args: {}, expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({ schemaVersion: 2 });
  });

  it("requires as for resolveFirstLoadedEkPath workflow ops", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-eknseg-missing-as.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "method.ek.eknseg@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "ek.eknseg",
            canonicalMethod: "ek.eknseg",
            result: {
              type: "object",
              required: ["ok"],
              properties: {
                ok: { const: true },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "resolveFirstLoadedEkPath",
              },
              {
                op: "projectResult",
                out: {
                  ok: true,
                },
              },
            ],
          },
          cases: [{ id: "basic", args: {}, expect: { ok: true } }],
        },
      }),
    ).toThrow(/workflow\.steps\[0\]\.as must be a non-empty string/);
  });

  it("requires as for EK workflow spiceCall ops", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-ekgc-missing-as.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "method.ek.ekgc@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "ek.ekgc",
            canonicalMethod: "ek.ekgc",
            result: {
              type: "object",
              required: ["found"],
              properties: {
                found: { const: true },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "spiceCall",
                call: "ekgc_c",
                in: ["SELECT EVENT FROM CASSINI_NOISE_EVENTS", 0, 0, 0],
              },
              {
                op: "projectResult",
                out: {
                  found: true,
                },
              },
            ],
          },
          cases: [{ id: "reads-event", args: {}, expect: { ok: true } }],
        },
      }),
    ).toThrow(/workflow\.steps\[0\]\.as is required when call="ekgc_c"/);
  });

  it("parses v2 method contract.result const literals (including arrays/objects)", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-legacy-const.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "methods/cells-windows/wnfetd@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "cells-windows.wnfetd",
          canonicalMethod: "cells-windows.wnfetd",
          result: {
            const: [0, { hi: 3 }],
          },
        },
        workflow: {
          steps: [{ op: "invokeLegacyCall" }],
        },
        cases: [{ id: "basic", args: [["window", 4], 0], expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({
      schemaVersion: 2,
      contract: {
        result: {
          const: [0, { hi: 3 }],
        },
      },
    });
  });

  it("rejects invokeLegacyCall workflows that include additional steps", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-legacy-shape.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/time/spiceVersion@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
            result: {
              type: "object",
              properties: {},
            },
          },
          workflow: {
            steps: [
              { op: "invokeLegacyCall" },
              { op: "projectResult", out: { ok: true } },
            ],
          },
          cases: [{ id: "basic", args: [] }],
        },
      }),
    ).toThrow(/must contain only invokeLegacyCall/);
  });

  it("rejects invokeLegacyCall workflows that define cleanup steps", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-legacy-cleanup.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/time/spiceVersion@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
            result: {
              type: "object",
              properties: {},
            },
          },
          workflow: {
            steps: [{ op: "invokeLegacyCall" }],
            cleanup: [{ op: "projectResult", out: { ignored: true } }],
          },
          cases: [{ id: "basic", args: [] }],
        },
      }),
    ).toThrow(/workflow\.cleanup must be empty/);
  });

  it("rejects non-array case args when workflow uses invokeLegacyCall", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-legacy-args.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/time/tkvrsn@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "time.tkvrsn",
            canonicalMethod: "time.tkvrsn",
            result: {
              type: "object",
              properties: {},
            },
          },
          workflow: {
            steps: [{ op: "invokeLegacyCall" }],
          },
          cases: [{ id: "toolkit", args: { mode: "TOOLKIT" } }],
        },
      }),
    ).toThrow(/cases\[0\]\.args must be an array when workflow uses invokeLegacyCall/);
  });

  it("rejects array-shaped case args when workflow does not use invokeLegacyCall", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-non-legacy-array-args.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/time/spiceVersion@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
            result: {
              type: "object",
              properties: {},
            },
          },
          workflow: {
            steps: [{ op: "projectResult", out: { ok: true } }],
          },
          cases: [{ id: "basic", args: [] }],
        },
      }),
    ).toThrow(/cases\[0\]\.args must be an object when workflow does not use invokeLegacyCall/);
  });

  it("rejects workflow cleanup entries that use invokeLegacyCall", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-cleanup-invoke-legacy.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/time/spiceVersion@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "time.spiceVersion",
            canonicalMethod: "time.spiceVersion",
            result: {
              type: "object",
              properties: {},
            },
          },
          workflow: {
            steps: [{ op: "projectResult", out: { ok: true } }],
            cleanup: [{ op: "invokeLegacyCall" }],
          },
          cases: [{ id: "basic", args: {} }],
        },
      }),
    ).toThrow(/workflow\.cleanup must not include invokeLegacyCall/);
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v3.yml",
        data: {
          schemaVersion: 3,
        },
      }),
    ).toThrow(/method\.schemaVersion must be 1 or 2/);

    expect(() =>
      parseCrossCuttingSpecAny({
        sourcePath: "/tmp/cross-v3.yml",
        data: {
          schemaVersion: 3,
        },
      }),
    ).toThrow(/crossCutting\.schemaVersion must be 1 or 2/);
  });
});
