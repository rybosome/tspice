import { describe, expect, it } from "vitest";

import { normalizeFunctionRegistrySource } from "../../src/dsl/functionRegistryNormalize.js";
import {
  parseFunctionRegistryCatalog,
  parseFunctionRegistrySource,
} from "../../src/dsl/functionRegistryValidate.js";

describe("function registry DSL validation", () => {
  it("accepts canonical input -> output -> buffers -> behaviorClass -> implemented -> executable ordering", () => {
    const parsed = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "coords-vectors.vdot",
            input: ["arg0", "arg1"],
            implemented: true,
            executable: {
              ts: {
                method: "vdot",
              },
              native: {
                handler: "generated_dispatch_coords_vectors_vdot",
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
          key: "coords-vectors.vdot",
          input: ["arg0", "arg1"],
          implemented: true,
          executable: {
            ts: {
              method: "vdot",
            },
            native: {
              handler: "generated_dispatch_coords_vectors_vdot",
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
              key: "coords-vectors.vdot",
              executable: {
                ts: { method: "vdot" },
                native: { handler: "generated_dispatch_coords_vectors_vdot" },
              },
              implemented: true,
              input: ["arg0", "arg1"],
            },
          ],
        },
      }),
    ).toThrow(/canonical field order/);
  });

  it("rejects unknown behavior class", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "time.str2et",
              input: ["utc"],
              behaviorClass: "mystery-behavior",
            },
          ],
        },
      }),
    ).toThrow(/unknown behavior class/);
  });

  it("rejects incompatible behavior class and shape", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "time.str2et",
              input: ["utc"],
              behaviorClass: "out-params-structured-payload",
            },
          ],
        },
      }),
    ).toThrow(/incompatible with function shape/);
  });

  it("rejects implemented:true without executable metadata", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "coords-vectors.vdot",
              input: ["arg0", "arg1"],
              implemented: true,
            },
          ],
        },
      }),
    ).toThrow(/implemented=true requires executable/);
  });

  it("rejects executable metadata when implemented is false/omitted", () => {
    expect(() =>
      parseFunctionRegistrySource({
        sourcePath: "specs/function-registry/function-registry.yaml",
        data: {
          dslVersion: 1,
          functions: [
            {
              key: "coords-vectors.vdot",
              input: ["arg0", "arg1"],
              executable: {
                ts: {
                  method: "vdot",
                },
                native: {
                  handler: "generated_dispatch_coords_vectors_vdot",
                },
              },
            },
          ],
        },
      }),
    ).toThrow(/implemented=false must not define executable metadata/);
  });

  it("normalization requires overrideReason when behaviorClass overrides default", () => {
    const source = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "frames.ccifrm",
            input: ["frameClass", "classId"],
            buffers: {
              frameName: {
                bytes: {
                  min: 64,
                  max: 1025,
                },
                elementType: "char",
              },
            },
            behaviorClass: "input-mapping-scalar-output",
          },
        ],
      },
    });

    expect(() => normalizeFunctionRegistrySource(source, ["frames.ccifrm"])).toThrow(
      /override requires overrideReason/,
    );
  });

  it("normalization rejects overrideReason without an actual override", () => {
    const source = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "frames.ccifrm",
            input: ["frameClass", "classId"],
            buffers: {
              frameName: {
                bytes: {
                  min: 64,
                  max: 1025,
                },
                elementType: "char",
              },
            },
            behaviorClass: "string-buffer-bounds",
            overrideReason: "not actually overriding default",
          },
        ],
      },
    });

    expect(() => normalizeFunctionRegistrySource(source, ["frames.ccifrm"])).toThrow(
      /overrideReason is only allowed when behaviorClass overrides/,
    );
  });

  it("validates generated catalog shape for normalized fields", () => {
    const catalog = parseFunctionRegistryCatalog({
      dslVersion: 1,
      functions: [
        {
          key: "coords-vectors.vdot",
          input: ["arg0", "arg1"],
          behaviorClass: "input-mapping-scalar-output",
          implemented: true,
          executable: {
            ts: {
              method: "vdot",
            },
            native: {
              handler: "generated_dispatch_coords_vectors_vdot",
            },
          },
        },
      ],
    });

    expect(catalog.functions).toHaveLength(1);
    expect(catalog.functions[0]?.implemented).toBe(true);
  });
});
