import { describe, expect, it } from "vitest";

import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";
import { lookupNativeReturnBindingEntry } from "../src/generated/nativeReturnBindings.js";
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

  it("executes own-spec single-call workflows with object args in tspice runner", async () => {
    const tspice = await createTspiceRunner();

    const input: RunCaseInputV2 = {
      schemaVersion: 3,
      manifest: {
        id: "methods/ids-names/bodc2s@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "ids-names.bodc2s",
        canonicalMethod: "ids-names.bodc2s",
        aliases: [],
        args: [{ name: "code", type: "spiceInt" }],
        result: { const: "EARTH" },
        errors: [],
      },
      args: { code: 399 },
      workflow: {
        steps: [{ op: "call", call: "ids-names.bodc2s", in: ["$args.code"] }],
      },
    };

    try {
      const out = await tspice.runCase(input);
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(typeof out.result).toBe("string");
      }
    } finally {
      await tspice.dispose?.();
    }
  });

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

  maybeIt("rejects forbidden call output bindings in cspice runner", async () => {
    const cspice = await createCspiceRunner();

    const input = createBaseInput();
    input.workflow.steps = [
      {
        op: "allocCell",
        as: "cell",
        params: { kind: "int", size: "$args.size" },
      },
      {
        op: "call",
        call: "cells-windows.scard",
        in: [0, "$refs.cell"],
        out: {
          ignored: "ignored",
        },
      } as unknown as RunCaseInputV2["workflow"]["steps"][number],
      {
        op: "projectResult",
        out: { size: "$args.size" },
      },
    ];
    input.workflow.cleanup = [{ op: "freeCell", target: "$refs.cell" }];

    try {
      const out = await cspice.runCase(input);
      expect(out.ok).toBe(false);

      if (!out.ok) {
        expect(out.error.code).toBe("invalid_args");
        expect(out.error.message).toContain("out");
      }
    } finally {
      await cspice.dispose?.();
    }
  });

  maybeIt("executes call via v3 workflow path in cspice runner", async () => {
    const cspice = await createCspiceRunner();

    const returnBinding = lookupNativeReturnBindingEntry("time.tkvrsn");
    expect(returnBinding).toBeDefined();
    expect(returnBinding?.kind).toBe("exprStringToJsonString");

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
        steps: [{ op: "call", call: "time.tkvrsn", in: ["$args.0"] }],
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

  maybeIt(
    "executes bodc2s via generated native return binding lane",
    async () => {
      const cspice = await createCspiceRunner();

      const returnBinding = lookupNativeReturnBindingEntry("ids-names.bodc2s");
      expect(returnBinding).toBeDefined();
      expect(returnBinding?.kind).toBe("exprSpiceIntToJsonStringViaSizedOutBuffer");

      const input: RunCaseInputV2 = {
        schemaVersion: 3,
        manifest: {
          id: "methods/ids-names/bodc2s@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "ids-names.bodc2s",
          canonicalMethod: "ids-names.bodc2s",
          aliases: [],
          args: [{ name: "code", type: "spiceInt" }],
          result: { const: "EARTH" },
          errors: [],
        },
        args: { code: 399 },
        workflow: {
          steps: [{ op: "call", call: "ids-names.bodc2s", in: ["$args.code"] }],
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
    },
  );

  maybeIt(
    "executes coords-vectors axisar via generated native return binding lane",
    async () => {
      const cspice = await createCspiceRunner();

      const returnBinding = lookupNativeReturnBindingEntry("coords-vectors.axisar");
      expect(returnBinding).toBeDefined();
      expect(returnBinding?.kind).toBe("generatedReturnBindingLane");

      const input: RunCaseInputV2 = {
        schemaVersion: 3,
        manifest: {
          id: "methods/coords-vectors/axisar@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "coords-vectors.axisar",
          canonicalMethod: "coords-vectors.axisar",
          errors: [],
        },
        args: [[0.1, 0.2, 0.3], 1.2],
        workflow: {
          steps: [{ op: "call", call: "coords-vectors.axisar", in: ["$args.0", "$args.1"] }],
        },
      };

      try {
        const out = await cspice.runCase(input);
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(Array.isArray(out.result)).toBe(true);
          expect((out.result as unknown[]).length).toBe(9);
        }
      } finally {
        await cspice.dispose?.();
      }
    },
  );
});
