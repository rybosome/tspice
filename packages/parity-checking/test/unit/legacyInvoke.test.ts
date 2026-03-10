import { describe, expect, it } from "vitest";

import { lowerV3CallContract } from "../../src/runners/legacyInvoke.js";
import type { RunCaseInputV3 } from "../../src/runners/types.js";

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

function makeInput(): RunCaseInputV3 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/tkvrsn@v3",
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
      steps: [{ op: "callContract" }],
    },
  };
}

describe("lowerV3CallContract", () => {
  it("returns lowered call+args for single-step callContract workflows", () => {
    const lowered = lowerV3CallContract(makeInput(), validation);

    expect(lowered).toEqual({
      call: "time.tkvrsn",
      args: ["TOOLKIT"],
    });
  });

  it("uses workflow step.call override when provided", () => {
    const input = makeInput();
    input.workflow.steps = [{ op: "callContract", call: "time.timout" }];

    const lowered = lowerV3CallContract(input, validation);
    expect(lowered?.call).toBe("time.timout");
  });

  it("returns null for non-legacy workflows", () => {
    const input = makeInput();
    input.workflow.steps = [
      {
        op: "projectResult",
        out: { ok: true },
      },
    ];

    expect(lowerV3CallContract(input, validation)).toBeNull();
  });

  it("raises invalid_request when callContract defines cleanup steps", () => {
    const input = makeInput();
    input.workflow.cleanup = [{ op: "freeCell", target: "$refs.tmp" }];

    expect(() => lowerV3CallContract(input, validation)).toThrow(
      /workflow must not define cleanup steps/,
    );

    try {
      lowerV3CallContract(input, validation);
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid_request");
    }
  });

  it("raises invalid_args when callContract case args are not an array", () => {
    const input = makeInput();
    input.args = { mode: "TOOLKIT" };

    expect(() => lowerV3CallContract(input, validation)).toThrow(
      /expects case args to be an array/,
    );

    try {
      lowerV3CallContract(input, validation);
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid_args");
    }
  });
});
