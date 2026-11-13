import { spiceClients } from "@rybosome/tspice";
import type { ParityCase } from "../src/case-types.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
import { describe, expect, it } from "vitest";
import type { RunTspiceContext } from "../src/run-tspice/context.js";
import { runErrorStep } from "../src/run-tspice/domains/error.js";

// Live comparisons cover captured diagnostics. These contained partial contexts
// provide only the two methods used by capture, to test false-success controls.
describe("signal capture rejects false success", () => {
  for (const behavior of ["no-op", "unrelated-error"] as const) {
    it(behavior, () => {
      const context = {
        spice: {
          raw: {
            sigerr: () => {
              if (behavior === "unrelated-error")
                throw new Error("unrelated failure");
            },
            failed: () => false,
          },
        },
      } as unknown as RunTspiceContext;
      expect(() =>
        runErrorStep(context, {
          op: "error.sigerr",
          short: "SPICE(TEST)",
          capture: true,
        }),
      ).toThrow(behavior === "no-op" ? /did not throw/ : /unrelated failure/);
    });
  }
});

describe("trace cleanup between workflows", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: early error unwinds nested trace before the next case`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        const first: ParityCase = {
          caseId: "cleanup-nested-error",
          description: "Fail with two open user frames",
          workflow: [
            { op: "error.chkin", name: "LEAK_OUTER" },
            { op: "error.chkin", name: "LEAK_INNER" },
            { op: "error.sigerr", short: "SPICE(CLEANUPFIRST)" },
          ],
          expectation: {
            kind: "error",
            errorMessageIncludes: ["CLEANUPFIRST"],
          },
        };
        const second: ParityCase = {
          caseId: "cleanup-next-signal",
          description: "Next workflow must have no user trace",
          workflow: [
            {
              op: "error.sigerr",
              short: "SPICE(CLEANUPSECOND)",
              capture: true,
            },
          ],
          expectation: { kind: "success" },
        };
        try {
          const failed = runCaseInTspice(spice, first, process.cwd());
          expect(failed.ok).toBe(false);
          if (!failed.ok)
            expect(failed.error.message).toContain("CLEANUPFIRST");
          const next = runCaseInTspice(spice, second, process.cwd());
          expect(next.ok).toBe(true);
          expect(next.outputs).toEqual([
            {
              op: "error.sigerr",
              value: {
                short: "SPICE(CLEANUPSECOND)",
                long: "",
                trace: "",
                failed: false,
              },
            },
          ]);
        } finally {
          await dispose();
        }
      },
    );
  }
});
