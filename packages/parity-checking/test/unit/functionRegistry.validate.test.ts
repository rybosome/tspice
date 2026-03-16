import { describe, expect, it } from "vitest";

import {
  parseFunctionRegistryCatalog,
  parseFunctionRegistryFunction,
  parseFunctionRegistryManifest,
} from "../../src/dsl/functionRegistryValidate.js";

describe("function registry DSL validation", () => {
  it("accepts canonical input -> output -> buffers ordering", () => {
    const parsed = parseFunctionRegistryFunction({
      sourcePath: "specs/function-registry/functions/time.str2et.yaml",
      data: {
        key: "time.str2et",
        input: {
          utc: "$.in[0]",
        },
        output: {
          value: {
            from: "return",
            type: "spiceDouble",
          },
        },
        buffers: {
          scratch: {
            lengthFrom: "$.in[1]",
            elementType: "spiceDouble",
          },
        },
      },
    });

    expect(parsed).toEqual({
      key: "time.str2et",
      input: { utc: "$.in[0]" },
      output: {
        value: {
          from: "return",
          type: "spiceDouble",
        },
      },
      buffers: {
        scratch: {
          lengthFrom: "$.in[1]",
          elementType: "spiceDouble",
        },
      },
    });
  });

  it("rejects unknown keys", () => {
    expect(() =>
      parseFunctionRegistryFunction({
        sourcePath: "specs/function-registry/functions/time.str2et.yaml",
        data: {
          key: "time.str2et",
          input: {},
          output: {
            value: {
              from: "return",
            },
          },
          aliases: ["str2et"],
        },
      }),
    ).toThrow(/unknown key/);
  });

  it("rejects wrong canonical field order", () => {
    expect(() =>
      parseFunctionRegistryFunction({
        sourcePath: "specs/function-registry/functions/frames.ccifrm.yaml",
        data: {
          key: "frames.ccifrm",
          buffers: {
            frameName: {
              bytes: { min: 64, max: 1025 },
            },
          },
          output: {
            payload: {
              frameName: "out.frameName",
            },
          },
          input: {
            classId: "$.in[0]",
          },
        },
      }),
    ).toThrow(/canonical field order input -> output -> buffers/);
  });

  it("rejects ambiguous output shape", () => {
    expect(() =>
      parseFunctionRegistryFunction({
        sourcePath: "specs/function-registry/functions/ids-names.bodn2c.yaml",
        data: {
          key: "ids-names.bodn2c",
          input: {
            name: "$.in[0]",
          },
          output: {
            value: { from: "out.code" },
            payload: { found: "out.found" },
          },
        },
      }),
    ).toThrow(/exactly one of output.value or output.payload/);
  });

  it("rejects invalid bytes bounds", () => {
    expect(() =>
      parseFunctionRegistryFunction({
        sourcePath: "specs/function-registry/functions/frames.ccifrm.yaml",
        data: {
          key: "frames.ccifrm",
          input: {
            classId: "$.in[0]",
          },
          output: {
            payload: {
              frameName: "out.frameName",
            },
          },
          buffers: {
            frameName: {
              bytes: {
                min: 2048,
                max: 1025,
              },
            },
          },
        },
      }),
    ).toThrow(/bytes\.min must be <= bytes\.max/);
  });

  it("validates manifest and generated catalog shapes", () => {
    const manifest = parseFunctionRegistryManifest({
      sourcePath: "specs/function-registry/manifest.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "time.str2et",
            file: "time.str2et.yaml",
          },
        ],
      },
    });

    expect(manifest.dslVersion).toBe(1);
    expect(manifest.functions).toEqual([
      {
        key: "time.str2et",
        file: "time.str2et.yaml",
      },
    ]);

    const catalog = parseFunctionRegistryCatalog({
      dslVersion: 1,
      functions: [
        {
          key: "time.str2et",
          input: {
            utc: "$.in[0]",
          },
          output: {
            value: {
              from: "return",
              type: "spiceDouble",
            },
          },
        },
      ],
    });

    expect(catalog.functions).toHaveLength(1);
    expect(catalog.functions[0]?.key).toBe("time.str2et");
  });
});
