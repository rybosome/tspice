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

  maybeIt(
    "executes file-io.exists via generated native return binding lane with $refs path input",
    async () => {
      const cspice = await createCspiceRunner();

      const returnBinding = lookupNativeReturnBindingEntry("file-io.exists");
      expect(returnBinding).toBeDefined();
      expect(returnBinding?.kind).toBe("generatedReturnBindingLane");

      const input: RunCaseInputV2 = {
        schemaVersion: 3,
        manifest: {
          id: "methods/file-io/exists@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "file-io.exists",
          canonicalMethod: "file-io.exists",
          errors: [],
        },
        args: {},
        workflow: {
          steps: [
            {
              op: "materialize",
              fixture: "virtualOutputSpk",
              as: "spkPath",
            },
            {
              op: "call",
              call: "file-io.exists",
              in: ["$refs.spkPath"],
            },
          ],
        },
      };

      try {
        const out = await cspice.runCase(input);
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(out.result).toBe(true);
        }
      } finally {
        await cspice.dispose?.();
      }
    },
  );

  maybeIt(
    "executes cells-windows.wncard via generated native return binding lane with $refs window input",
    async () => {
      const cspice = await createCspiceRunner();

      const returnBinding = lookupNativeReturnBindingEntry("cells-windows.wncard");
      expect(returnBinding).toBeDefined();
      expect(returnBinding?.kind).toBe("generatedReturnBindingLane");

      const input: RunCaseInputV2 = {
        schemaVersion: 3,
        manifest: {
          id: "methods/cells-windows/wncard@v3",
          kind: "method",
        },
        contract: {
          contractMethod: "cells-windows.wncard",
          canonicalMethod: "cells-windows.wncard",
          errors: [],
        },
        args: {},
        workflow: {
          steps: [
            {
              op: "allocWindow",
              as: "window",
              params: {
                maxIntervals: 4,
              },
            },
            {
              op: "call",
              call: "cells-windows.wninsd",
              in: [0, 3, "$refs.window"],
            },
            {
              op: "call",
              call: "cells-windows.wncard",
              in: ["$refs.window"],
            },
          ],
          cleanup: [
            {
              op: "freeWindow",
              target: "$refs.window",
            },
          ],
        },
      };

      try {
        const out = await cspice.runCase(input);
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(out.result).toBe(1);
        }
      } finally {
        await cspice.dispose?.();
      }
    },
  );

  maybeIt(
    "executes representative generated return-binding calls across remaining domains",
    async () => {
      const cspice = await createCspiceRunner();

      const cases: Array<{
        name: string;
        input: RunCaseInputV2;
        assertResult: (result: unknown) => void;
      }> = [
        {
          name: "ephemeris.spkgeo",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/ephemeris/spkgeo",
              kind: "method",
            },
            contract: {
              contractMethod: "ephemeris.spkgeo",
              canonicalMethod: "ephemeris.spkgeo",
              errors: [],
            },
            args: {},
            workflow: {
              steps: [
                { op: "materialize", fixture: "virtualOutputSpk", as: "spkPath" },
                { op: "call", call: "kernels.furnsh", in: ["$refs.spkPath"] },
                { op: "call", call: "ephemeris.spkgeo", in: [1000, 30, "J2000", 0] },
              ],
              cleanup: [
                { op: "call", call: "kernels.unload", in: ["$refs.spkPath"] },
                { op: "unlink", target: "$refs.spkPath" },
              ],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({
              state: expect.any(Array),
              lt: expect.any(Number),
            });
            expect((result as { state: unknown[] }).state).toHaveLength(6);
          },
        },
        {
          name: "file-io.getfat",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/file-io/getfat",
              kind: "method",
            },
            contract: {
              contractMethod: "file-io.getfat",
              canonicalMethod: "file-io.getfat",
              errors: [],
            },
            args: {},
            workflow: {
              steps: [
                { op: "materialize", fixture: "virtualOutputSpk", as: "spkPath" },
                { op: "call", call: "file-io.getfat", in: ["$refs.spkPath"] },
              ],
              cleanup: [{ op: "unlink", target: "$refs.spkPath" }],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({
              arch: expect.any(String),
              type: expect.any(String),
            });
          },
        },
        {
          name: "frames.namfrm",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/frames/namfrm",
              kind: "method",
            },
            contract: {
              contractMethod: "frames.namfrm",
              canonicalMethod: "frames.namfrm",
              errors: [],
            },
            args: ["J2000"],
            workflow: {
              steps: [{ op: "call", call: "frames.namfrm", in: ["$args.0"] }],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({ found: true, code: 1 });
          },
        },
        {
          name: "ids-names.bodn2c",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/ids-names/bodn2c",
              kind: "method",
            },
            contract: {
              contractMethod: "ids-names.bodn2c",
              canonicalMethod: "ids-names.bodn2c",
              errors: [],
            },
            args: ["EARTH"],
            workflow: {
              steps: [{ op: "call", call: "ids-names.bodn2c", in: ["$args.0"] }],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({ found: true, code: 399 });
          },
        },
        {
          name: "kernel-pool.pdpool+gdpool",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/kernel-pool/gdpool",
              kind: "method",
            },
            contract: {
              contractMethod: "kernel-pool.gdpool",
              canonicalMethod: "kernel-pool.gdpool",
              errors: [],
            },
            args: {},
            workflow: {
              steps: [
                { op: "call", call: "kernel-pool.pdpool", in: ["TSPICE_PRECHECK_V2", [1, 2, 3]] },
                { op: "call", call: "kernel-pool.gdpool", in: ["TSPICE_PRECHECK_V2", 0, 3] },
              ],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({ found: true, values: [1, 2, 3] });
          },
        },
        {
          name: "kernels.kdata",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/kernels/kdata",
              kind: "method",
            },
            contract: {
              contractMethod: "kernels.kdata",
              canonicalMethod: "kernels.kdata",
              errors: [],
            },
            args: {},
            workflow: {
              steps: [
                { op: "materialize", fixture: "virtualOutputSpk", as: "spkPath" },
                { op: "call", call: "kernels.furnsh", in: ["$refs.spkPath"] },
                { op: "call", call: "kernels.kdata", in: [0, "ALL"] },
              ],
              cleanup: [
                { op: "call", call: "kernels.unload", in: ["$refs.spkPath"] },
                { op: "unlink", target: "$refs.spkPath" },
              ],
            },
          },
          assertResult: (result) => {
            expect(result).toMatchObject({
              found: true,
              file: expect.any(String),
              filtyp: expect.any(String),
              source: expect.any(String),
              handle: expect.any(Number),
            });
          },
        },
        {
          name: "time.tparse",
          input: {
            schemaVersion: 3,
            manifest: {
              id: "preflight/time/tparse",
              kind: "method",
            },
            contract: {
              contractMethod: "time.tparse",
              canonicalMethod: "time.tparse",
              errors: [],
            },
            args: ["2000 JAN 01 12:00:00"],
            workflow: {
              steps: [{ op: "call", call: "time.tparse", in: ["$args.0"] }],
            },
          },
          assertResult: (result) => {
            expect(typeof result).toBe("number");
          },
        },
      ];

      try {
        for (const testCase of cases) {
          const out = await cspice.runCase(testCase.input);
          if (!out.ok) {
            expect(out.error.code, `${testCase.name} should not be unsupported_call`).not.toBe(
              "unsupported_call",
            );
          }
          expect(out.ok, `${testCase.name} should succeed`).toBe(true);

          if (out.ok) {
            testCase.assertResult(out.result);
          }
        }
      } finally {
        await cspice.dispose?.();
      }
    },
  );
});
