import { describe, expect, it } from "vitest";

import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import type { RunCaseInputV2 } from "../src/runners/types.js";

function createBaseInput(): RunCaseInputV2 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/cells-windows/newIntCell@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "cells-windows.newIntCell",
      canonicalMethod: "cells-windows.newIntCell",
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

describe("v3 runner preflight parity", () => {
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
        expect(tspiceOut.error.spice).toEqual({ failed: false });
        expect(cspiceOut.error.spice).toEqual({ failed: false });
      }
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });

  maybeIt("reports matching assert failure envelopes for tspice and cspice runners", async () => {
    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "assert",
        test: {
          gt: ["$args.size", 3],
        },
        error: {
          code: "assert_size_gt_three",
          message: "size must be > 3",
        },
      },
      {
        op: "projectResult",
        out: { size: "$args.size" },
      },
    ];

    try {
      const [tspiceOut, cspiceOut] = await Promise.all([tspice.runCase(input), cspice.runCase(input)]);

      expect(tspiceOut.ok).toBe(false);
      expect(cspiceOut.ok).toBe(false);

      if (!tspiceOut.ok && !cspiceOut.ok) {
        expect(tspiceOut.error.code).toBe("assert_size_gt_three");
        expect(cspiceOut.error.code).toBe("assert_size_gt_three");
        expect(tspiceOut.error.message).toBe("size must be > 3");
        expect(cspiceOut.error.message).toBe("size must be > 3");
        expect(tspiceOut.error.spice).toEqual({ failed: false });
        expect(cspiceOut.error.spice).toEqual({ failed: false });
      }
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });

  maybeIt("executes callContract via v3 workflow path in cspice runner", async () => {
    const cspice = await createCspiceRunner();

    const input: RunCaseInputV2 = {
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
        errors: [],
      },
      args: ["TOOLKIT"],
      workflow: {
        steps: [{ op: "callContract" }],
      },
    };

    try {
      const out = await cspice.runCase(input);
      expect(out.ok).toBe(true);

      if (out.ok) {
        expect(typeof out.result).toBe("string");
      }
    } finally {
      await cspice.dispose?.();
    }
  });

  maybeIt("executes cells/windows callContract recipes via cspice fast-path", async () => {
    const cspice = await createCspiceRunner();

    const input: RunCaseInputV2 = {
      schemaVersion: 3,
      manifest: {
        id: "methods/cells-windows/insrtc@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "cells-windows.insrtc",
        canonicalMethod: "cells-windows.insrtc",
        result: {
          type: "object",
          properties: {},
        },
        errors: [],
      },
      args: ["alpha", ["char", 8, 16]],
      workflow: {
        steps: [{ op: "callContract" }],
      },
    };

    try {
      const out = await cspice.runCase(input);
      expect(out.ok).toBe(true);

      if (out.ok) {
        expect(out.result).toEqual({ card: 1, size: 8 });
      }
    } finally {
      await cspice.dispose?.();
    }
  });

  maybeIt("expands $FIXTURES setup kernels in callContract fast-path", async () => {
    const cspice = await createCspiceRunner();

    const input: RunCaseInputV2 = {
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
        errors: [],
      },
      setup: {
        kernels: ["$FIXTURES/basic-time"],
      },
      args: ["TOOLKIT"],
      workflow: {
        steps: [{ op: "callContract" }],
      },
    };

    try {
      const out = await cspice.runCase(input);
      expect(out.ok).toBe(true);

      if (out.ok) {
        expect(typeof out.result).toBe("string");
      }
    } finally {
      await cspice.dispose?.();
    }
  });
});
