import { describe, expect, it } from "vitest";

import { GENERATED_DISPATCH_UNAVAILABLE_CODE } from "../../src/runners/generatedDispatchSeam.js";
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

describe("workflow executor canonical call-step semantics", () => {
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

  it("rejects call-step keys outside op/fn/in", () => {
    const withAs = {
      op: "call" as const,
      fn: "time.str2et",
      in: "$args",
      as: "captured",
    };

    expect(() => executeCanonicalWorkflowCase("node", buildInput(withAs))).toThrow(/unknown key: "as"/);

    const withOut = {
      op: "call" as const,
      fn: "time.str2et",
      in: "$args",
      out: { et: "captured" },
    };

    expect(() => executeCanonicalWorkflowCase("node", buildInput(withOut))).toThrow(/unknown key: "out"/);
  });

  it("supports top-level $args and $args.<path> string-token resolution", () => {
    const step = {
      op: "call" as const,
      fn: "$args.fn",
      in: "$args.payload",
    };

    try {
      executeCanonicalWorkflowCase(
        "node",
        buildInput(step, {
          fn: "time.str2et",
          payload: ["2010-01-01T00:00:00"],
        }),
      );
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; details?: Record<string, unknown> };
      expect(withCode.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
      expect(withCode.details).toMatchObject({
        fn: "time.str2et",
      });
    }
  });

  it("rejects $refs and $refs.<path> tokens at call boundaries", () => {
    const refsFn = {
      op: "call" as const,
      fn: "$refs.cachedFn",
      in: "$args",
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(refsFn, { fn: "time.str2et" }));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; message: string };
      expect(withCode.code).toBe("invalid_request");
      expect(withCode.message).toMatch(/does not support \$refs/);
    }

    const refsIn = {
      op: "call" as const,
      fn: "time.str2et",
      in: "$refs.cachedInput",
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(refsIn, { fn: "time.str2et" }));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; message: string };
      expect(withCode.code).toBe("invalid_request");
      expect(withCode.message).toMatch(/does not support \$refs/);
    }
  });

  it("does not recursively substitute nested reference-like strings inside object/array payloads", () => {
    const step = {
      op: "call" as const,
      fn: "time.str2et",
      in: {
        nestedArgsRef: "$args.missing",
        nestedRefsRef: "$refs.cached",
        list: ["$args.alsoMissing"],
      },
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(step, { fn: "time.str2et" }));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string };
      expect(withCode.code).toBe(GENERATED_DISPATCH_UNAVAILABLE_CODE);
    }
  });

  it("still rejects invalid top-level args references", () => {
    const step = {
      op: "call" as const,
      fn: "time.str2et",
      in: "$args.missing",
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(step, { fn: "time.str2et" }));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; message: string };
      expect(withCode.code).toBe("invalid_args");
      expect(withCode.message).toMatch(/missing argument/);
    }
  });

  it("rejects malformed top-level $args expressions", () => {
    const step = {
      op: "call" as const,
      fn: "$args.",
      in: "$args",
    };

    try {
      executeCanonicalWorkflowCase("node", buildInput(step, { fn: "time.str2et" }));
      throw new Error("expected executeCanonicalWorkflowCase to throw");
    } catch (error) {
      const withCode = error as Error & { code?: string; message: string };
      expect(withCode.code).toBe("invalid_request");
      expect(withCode.message).toMatch(/Invalid reference expression/);
    }
  });
});
