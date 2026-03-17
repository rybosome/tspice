import { describe, expect, it } from "vitest";

import { normalizeFunctionRegistrySource } from "../../src/dsl/functionRegistryNormalize.js";
import { parseFunctionRegistrySource } from "../../src/dsl/functionRegistryValidate.js";

describe("function registry normalization", () => {
  it("auto-fills missing contract keys with implemented:false defaults", () => {
    const source = parseFunctionRegistrySource({
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

    const { catalog, diagnostics } = normalizeFunctionRegistrySource(source, [
      "coords-vectors.vdot",
      "error.failed",
    ]);

    expect(diagnostics).toEqual({
      missingKeys: ["error.failed"],
      extraKeys: [],
    });

    const missingEntry = catalog.functions.find((entry) => entry.key === "error.failed");
    expect(missingEntry).toEqual({
      key: "error.failed",
      input: [],
      behaviorClass: "input-mapping-scalar-output",
      implemented: false,
    });
  });

  it("hard-fails when source contains keys not in contract catalog", () => {
    const source = parseFunctionRegistrySource({
      sourcePath: "specs/function-registry/function-registry.yaml",
      data: {
        dslVersion: 1,
        functions: [
          {
            key: "coords-vectors.vdot",
            input: ["arg0", "arg1"],
          },
          {
            key: "ghost.not-in-contract",
            input: [],
          },
        ],
      },
    });

    expect(() =>
      normalizeFunctionRegistrySource(source, ["coords-vectors.vdot"]),
    ).toThrow(/extra=1/);
  });

  it("accepts behaviorClass override only when overrideReason is supplied", () => {
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
            overrideReason: "staged rollout keeps this in scalar class for now",
          },
        ],
      },
    });

    const { catalog } = normalizeFunctionRegistrySource(source, ["frames.ccifrm"]);
    expect(catalog.functions).toEqual([
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
        implemented: false,
        overrideReason: "staged rollout keeps this in scalar class for now",
      },
    ]);
  });
});
