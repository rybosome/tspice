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

  it("parses v2 assert workflow steps", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-assert.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "methods/cells-windows/newIntCell-assert@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "cells-windows.newIntCell",
          canonicalMethod: "cells-windows.newIntCell",
          args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
          result: {
            type: "object",
            required: ["size"],
            properties: {
              size: { type: "spiceInt" },
            },
          },
        },
        workflow: {
          steps: [
            {
              op: "assert",
              test: {
                gte: ["$args.size", 0],
              },
              error: {
                code: "assert_size_non_negative",
                message: "size must be non-negative",
              },
            },
            {
              op: "projectResult",
              out: {
                size: "$args.size",
              },
            },
          ],
        },
        cases: [{ id: "ok", args: { size: 3 }, expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({
      schemaVersion: 2,
      workflow: {
        steps: expect.arrayContaining([
          {
            op: "assert",
            test: {
              gte: ["$args.size", 0],
            },
            error: {
              code: "assert_size_non_negative",
              message: "size must be non-negative",
            },
          },
        ]),
      },
    });
  });

  it("rejects v2 assert workflows with unsupported operators", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-assert-bad-op.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/cells-windows/newIntCell-assert@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "cells-windows.newIntCell",
            canonicalMethod: "cells-windows.newIntCell",
            args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
            result: {
              type: "object",
              required: ["size"],
              properties: {
                size: { type: "spiceInt" },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "assert",
                test: {
                  between: ["$args.size", 0],
                },
                error: {
                  code: "assert_size_invalid",
                  message: "size failed assertion",
                },
              },
              {
                op: "projectResult",
                out: {
                  size: "$args.size",
                },
              },
            ],
          },
          cases: [{ id: "ok", args: { size: 3 }, expect: { ok: true } }],
        },
      }),
    ).toThrow(/methodV2\.workflow\.steps\[0\]\.test operator must be one of/);
  });

  it("rejects v2 assert workflows with non-binary tests", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-assert-bad-arity.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/cells-windows/newIntCell-assert@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "cells-windows.newIntCell",
            canonicalMethod: "cells-windows.newIntCell",
            args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
            result: {
              type: "object",
              required: ["size"],
              properties: {
                size: { type: "spiceInt" },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "assert",
                test: {
                  eq: ["$args.size"],
                },
                error: {
                  code: "assert_size_invalid",
                  message: "size failed assertion",
                },
              },
              {
                op: "projectResult",
                out: {
                  size: "$args.size",
                },
              },
            ],
          },
          cases: [{ id: "ok", args: { size: 3 }, expect: { ok: true } }],
        },
      }),
    ).toThrow(/methodV2\.workflow\.steps\[0\]\.test\.eq must be a 2-item array/);
  });

  it("parses v2 project and switch workflow steps", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-project-switch.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "methods/cells-windows/newIntCell-project-switch@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "cells-windows.newIntCell",
          canonicalMethod: "cells-windows.newIntCell",
          args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
          result: {
            type: "object",
            required: ["size"],
            properties: {
              size: { type: "spiceInt" },
            },
          },
        },
        workflow: {
          steps: [
            {
              op: "project",
              out: {
                selectedSize: "$args.size",
              },
            },
            {
              op: "switch",
              on: "$refs.selectedSize",
              cases: {
                0: [
                  {
                    op: "projectResult",
                    out: {
                      size: 0,
                    },
                  },
                ],
              },
              default: [
                {
                  op: "projectResult",
                  out: {
                    size: "$refs.selectedSize",
                  },
                },
              ],
            },
          ],
        },
        cases: [{ id: "ok", args: { size: 3 }, expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({
      schemaVersion: 2,
      workflow: {
        steps: expect.arrayContaining([
          expect.objectContaining({
            op: "project",
            out: {
              selectedSize: "$args.size",
            },
          }),
          expect.objectContaining({
            op: "switch",
            on: "$refs.selectedSize",
          }),
        ]),
      },
    });
  });

  it("rejects v2 switch workflows with non-array case entries", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-switch-invalid-case.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/cells-windows/newIntCell-project-switch@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "cells-windows.newIntCell",
            canonicalMethod: "cells-windows.newIntCell",
            args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
            result: {
              type: "object",
              required: ["size"],
              properties: {
                size: { type: "spiceInt" },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "switch",
                on: "$args.size",
                cases: {
                  bad: {
                    op: "projectResult",
                    out: {
                      size: 1,
                    },
                  },
                },
              },
            ],
          },
          cases: [{ id: "ok", args: { size: 3 }, expect: { ok: true } }],
        },
      }),
    ).toThrow(/methodV2\.workflow\.steps\[0\]\.cases\.bad must be an array/);
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

  it("parses v2 dskb02_c spiceCall using named out map", () => {
    const methodV2 = parseMethodSpecAny({
      sourcePath: "/tmp/method-v2-dskb02-out.yml",
      data: {
        schemaVersion: 2,
        manifest: {
          id: "methods/dsk/dskb02@v2",
          kind: "method",
        },
        contract: {
          contractMethod: "dsk.dskb02",
          canonicalMethod: "dsk.dskb02",
          result: {
            type: "object",
            required: ["nv"],
            properties: {
              nv: { type: "spiceInt" },
            },
          },
        },
        workflow: {
          steps: [
            { op: "materialize", fixture: "minimalDsk", as: "dskPath" },
            { op: "dasOpen", path: "$refs.dskPath", as: "dasHandle" },
            { op: "dlaBeginForwardSearch", handle: "$refs.dasHandle", as: "dladsc" },
            {
              op: "spiceCall",
              call: "dskb02_c",
              in: ["$refs.dasHandle", "$refs.dladsc"],
              out: { nv: "nv" },
            },
            { op: "projectResult", out: { nv: "$refs.nv" } },
          ],
          cleanup: [
            { op: "dasClose", target: "$refs.dasHandle" },
            { op: "unlink", target: "$refs.dskPath" },
          ],
        },
        cases: [{ id: "ok", args: {}, expect: { ok: true } }],
      },
    });

    expect(methodV2).toMatchObject({ schemaVersion: 2 });
    expect(methodV2.workflow.steps[0]).toMatchObject({
      op: "materialize",
      fixture: "minimalDsk",
      as: "dskPath",
    });
    expect(methodV2.workflow.steps[3]).toMatchObject({
      op: "spiceCall",
      call: "dskb02_c",
      out: { nv: "nv" },
    });
  });

  it("rejects dskb02_c spiceCall entries that omit out map", () => {
    expect(() =>
      parseMethodSpecAny({
        sourcePath: "/tmp/method-v2-dskb02-missing-out.yml",
        data: {
          schemaVersion: 2,
          manifest: {
            id: "methods/dsk/dskb02@v2",
            kind: "method",
          },
          contract: {
            contractMethod: "dsk.dskb02",
            canonicalMethod: "dsk.dskb02",
            result: {
              type: "object",
              required: ["nv"],
              properties: {
                nv: { type: "spiceInt" },
              },
            },
          },
          workflow: {
            steps: [
              {
                op: "spiceCall",
                call: "dskb02_c",
                in: ["$refs.handle", "$refs.dladsc"],
                as: "nv",
              },
              { op: "projectResult", out: { nv: 1 } },
            ],
          },
          cases: [{ id: "bad", args: {}, expect: { ok: false } }],
        },
      }),
    ).toThrow(/out is required when call="dskb02_c"/);
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
