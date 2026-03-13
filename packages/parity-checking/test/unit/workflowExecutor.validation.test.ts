import { describe, expect, it } from "vitest";

import { executeCanonicalWorkflowCase } from "../../src/runners/workflowExecutor.js";

import type { RunCaseInputV3 } from "../../src/runners/types.js";

function buildInput(step: unknown, args: unknown = ["2010-01-01T00:00:00"]): RunCaseInputV3 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/str2et@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
      errors: [],
    },
    args,
    workflow: {
      steps: [step as RunCaseInputV3["workflow"]["steps"][number]],
    },
  };
}

function nestedArray(depth: number): unknown {
  let value: unknown = "$args";
  for (let index = 0; index < depth; index += 1) {
    value = [value];
  }
  return value;
}

describe("workflow executor validation and safety guards", () => {
  it("validates each step once before execution", () => {
    let fnReads = 0;

    const step: Record<string, unknown> = {
      op: "call",
      in: "$args",
    };

    Object.defineProperty(step, "fn", {
      enumerable: true,
      configurable: true,
      get() {
        fnReads += 1;
        return "time.str2et";
      },
    });

    expect(() => executeCanonicalWorkflowCase("node", buildInput(step))).toThrow(
      /Generated dispatch is unavailable/,
    );
    expect(fnReads).toBe(1);
  });

  it("rejects deeply nested workflow input payloads", () => {
    const deepInput = nestedArray(60);

    const step = {
      op: "call" as const,
      fn: "time.str2et",
      in: deepInput,
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(step));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string };
      expect(withCode.code).toBe("invalid_request");
      expect(withCode.message).toMatch(/too deeply nested/);
    }
  });

  it("rejects oversized workflow input payloads", () => {
    const wideInput = Array.from({ length: 10_050 }, () => "$args");

    const step = {
      op: "call" as const,
      fn: "time.str2et",
      in: wideInput,
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(step));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string };
      expect(withCode.code).toBe("invalid_request");
      expect(withCode.message).toMatch(/too large to resolve safely/);
    }
  });
});
