import { describe, expect, it } from "vitest";

import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import type { RunCaseInputV2 } from "../src/runners/types.js";

function createBaseInput(): RunCaseInputV2 {
  return {
    schemaVersion: 2,
    manifest: {
      id: "methods/cells-windows/newIntCell@v2",
      kind: "method",
    },
    contract: {
      contractMethod: "cells-windows.newIntCell",
      canonicalMethod: "cells-windows.newIntCell",
      aliases: [],
      args: [{ name: "size", type: "spiceInt", constraints: { min: 0 } }],
      result: {
        type: "object",
        required: ["size"],
        properties: {
          size: { type: "spiceInt" },
        },
      },
      errors: [],
    },
    args: { size: 3 },
    workflow: {
      steps: [
        {
          op: "projectResult",
          out: { size: "$args.size" },
        },
      ],
    },
  };
}

describe("v2 runner preflight parity", () => {
  const status = getCspiceRunnerStatus();
  const maybeIt = status.ready ? it : it.skip;

  maybeIt("reports the same contract-arg validation failure for tspice and cspice runners", async () => {
    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    const input = createBaseInput();
    input.args = {
      size: 3,
      extra: 7,
    };

    try {
      const [tspiceOut, cspiceOut] = await Promise.all([tspice.runCase(input), cspice.runCase(input)]);

      expect(tspiceOut.ok).toBe(false);
      expect(cspiceOut.ok).toBe(false);

      if (!tspiceOut.ok && !cspiceOut.ok) {
        expect(tspiceOut.error.code).toBe("invalid_args");
        expect(cspiceOut.error.code).toBe("invalid_args");
        expect(cspiceOut.error.message).toBe(tspiceOut.error.message);
      }
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });
});
