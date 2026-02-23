import { describe, expect, it } from "vitest";

import { lowerV2InvokeLegacyCall } from "../../src/runners/legacyInvoke.js";
import type { RunCaseInputV2 } from "../../src/runners/types.js";

type RunnerValidationCode = "invalid_request" | "invalid_args";

function raiseValidationError(code: RunnerValidationCode, message: string): never {
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = code;
  throw err;
}

const validation = {
  invalidRequest(message: string): never {
    return raiseValidationError("invalid_request", message);
  },
  invalidArgs(message: string): never {
    return raiseValidationError("invalid_args", message);
  },
};

function makeInput(): RunCaseInputV2 {
  return {
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
    args: ["TOOLKIT"],
    workflow: {
      steps: [{ op: "invokeLegacyCall" }],
    },
  };
}

describe("lowerV2InvokeLegacyCall", () => {
  it("returns lowered call+args for single-step invokeLegacyCall workflows", () => {
    const lowered = lowerV2InvokeLegacyCall(makeInput(), validation);

    expect(lowered).toEqual({
      call: "time.tkvrsn",
      args: ["TOOLKIT"],
    });
  });

  it("uses workflow step.call override when provided", () => {
    const input = makeInput();
    input.workflow.steps = [{ op: "invokeLegacyCall", call: "time.spiceVersion" }];

    const lowered = lowerV2InvokeLegacyCall(input, validation);
    expect(lowered?.call).toBe("time.spiceVersion");
  });

  it("returns null for non-legacy workflows", () => {
    const input = makeInput();
    input.workflow.steps = [
      {
        op: "projectResult",
        out: { ok: true },
      },
    ];

    expect(lowerV2InvokeLegacyCall(input, validation)).toBeNull();
  });

  it("raises invalid_request when invokeLegacyCall defines cleanup steps", () => {
    const input = makeInput();
    input.workflow.cleanup = [{ op: "freeCell", target: "$refs.tmp" }];

    expect(() => lowerV2InvokeLegacyCall(input, validation)).toThrow(
      /workflow must not define cleanup steps/,
    );

    try {
      lowerV2InvokeLegacyCall(input, validation);
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid_request");
    }
  });

  it("raises invalid_args when invokeLegacyCall case args are not an array", () => {
    const input = makeInput();
    input.args = { mode: "TOOLKIT" };

    expect(() => lowerV2InvokeLegacyCall(input, validation)).toThrow(
      /expects case args to be an array/,
    );

    try {
      lowerV2InvokeLegacyCall(input, validation);
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid_args");
    }
  });
});
