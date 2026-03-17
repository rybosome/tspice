import { describe, expect, it } from "vitest";

import {
  parseFunctionRegistryCatalog,
  parseFunctionRegistrySource,
} from "../../src/dsl/functionRegistryValidate.js";

describe("function registry DSL validation", () => {
  it("accepts canonical input -> output -> buffers ordering", () => {
    const parsed = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "time.str2et",
            input: ["utc"],
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
        ],
      },
    });

    expect(parsed).toEqual({
      dslVersion: 1,
      functions: [
        {
          key: "time.str2et",
          input: ["utc"],
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
      ],
    });
  });

  it("rejects unknown keys", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "time.str2et",
              input: ["utc"],
              output: {
                value: {
                  from: "return",
                },
              },
              aliases: ["str2et"],
            },
          ],
        },
      }),
    ).toThrow(/unknown key/);
  });

  it("rejects wrong canonical field order", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
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
              input: ["classId"],
            },
          ],
        },
      }),
    ).toThrow(/canonical field order input -> output -> buffers/);
  });

  it("rejects duplicate input argument names", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "time.str2et",
              input: ["utc", "utc"],
            },
          ],
        },
      }),
    ).toThrow(/duplicate argument name/);
  });

  it("rejects ambiguous output shape", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "ids-names.bodn2c",
              input: ["name"],
              output: {
                value: { from: "out.code" },
                payload: { found: "out.found" },
              },
            },
          ],
        },
      }),
    ).toThrow(/exactly one of output.value or output.payload/);
  });

  it("rejects invalid bytes bounds", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "frames.ccifrm",
              input: ["classId"],
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
          ],
        },
      }),
    ).toThrow(/bytes\.min must be <= bytes\.max/);
  });

  it("validates canonical source and generated catalog shapes", () => {
    const source = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "time.str2et",
            input: ["utc"],
          },
        ],
      },
    });

    expect(source.dslVersion).toBe(1);
    expect(source.functions).toEqual([
      {
        key: "time.str2et",
        input: ["utc"],
      },
    ]);

    const catalog = parseFunctionRegistryCatalog({
      dslVersion: 1,
      functions: [
        {
          key: "time.str2et",
          input: ["utc"],
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
