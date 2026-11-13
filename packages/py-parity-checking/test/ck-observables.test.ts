import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import {
  cleanupContext,
  clearKernelState,
  createRunTspiceContext,
} from "../src/run-tspice/context.js";
import { dispatchStep } from "../src/run-tspice/dispatch.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixturesRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: CK accumulation reaches literal set and merged interval assertions`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      try {
        for (const [id, expected] of [
          [
            "frames-ckobj-audit-accumulate-across-files",
            { ids: [-123001, -123000] },
          ],
          [
            "frames-ckcov-audit-accumulate-across-files",
            {
              intervals: [
                { left: 1000, right: 1040 },
                { left: 1060, right: 1070 },
              ],
            },
          ],
        ] as const) {
          const c = allCases.find((c) => c.caseId === id);
          if (!c) throw new Error(id);
          const sidecar = await runCaseInSidecar(c, fixturesRoot),
            actual = runCaseInTspice(setup.spice, c, fixturesRoot);
          for (const result of [sidecar, actual]) {
            expect(result.ok).toBe(true);
            expect(result.outputs.at(-1)?.value).toEqual(expected);
          }
        }
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: real CK priority and alias unload have literal angular velocities`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      try {
        for (const id of [
          "frames-cklpf-audit-observable-search-priority",
          "frames-ckupf-audit-unload-effects-and-alias-noop",
        ]) {
          const c = allCases.find((c) => c.caseId === id);
          if (!c) throw Error(id);
          for (const result of [
            await runCaseInSidecar(c, fixturesRoot),
            runCaseInTspice(setup.spice, c, fixturesRoot),
          ]) {
            expect(result.ok).toBe(true);
            const a = {
              found: true,
              clkout: 1005,
              av: [
                expect.closeTo(-0.002 / Math.sqrt(14), 12),
                expect.closeTo(-0.004 / Math.sqrt(14), 12),
                expect.closeTo(-0.006 / Math.sqrt(14), 12),
              ],
            };
            const b = {
              found: true,
              clkout: 1005,
              av: [
                expect.closeTo(-0.004, 12),
                expect.closeTo(0, 12),
                expect.closeTo(0, 12),
              ],
            };
            expect(
              result.outputs
                .filter((x) => x.op === "frames.ckgpav")
                .map((x) => x.value),
            ).toMatchObject([a, b, a, b, b]);
          }
        }
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: pending CK is closed before Scratch cleanup, with failed close retried`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      let attempts = 0;
      const existed: boolean[] = [];
      let target = "";
      const wrapped = {
        ...setup.spice,
        raw: {
          ...setup.spice.raw,
          ckupf: (handle: number) => {
            attempts++;
            existed.push(fs.existsSync(target));
            if (attempts === 1) throw new Error("controlled close failure");
            setup.spice.raw.ckupf(handle);
          },
        },
      };
      const context = createRunTspiceContext(
        wrapped,
        fixturesRoot,
        `ck-cleanup-${backend}`,
      );
      target = path.join(context.paths.scratchRoot, "pending.bc");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(
        path.join(fixturesRoot, "kernels/audit-pointing.bc"),
        target,
      );
      clearKernelState(context);
      dispatchStep(context, {
        op: "frames.cklpf",
        ck: { kind: "scratch", rel: "pending.bc" },
        handleId: "PENDING",
      });
      try {
        cleanupContext(context);
        expect(attempts).toBe(2);
        expect(existed).toEqual([true, true]);
        expect(context.state.frames.ckHandles.size).toBe(0);
        expect(fs.existsSync(context.paths.scratchRoot)).toBe(false);
        expect(() => setup.spice.raw.ckgp(-123000, 1005, 0, "J2000")).toThrow(
          /NOLOADEDFILES/,
        );
      } finally {
        await setup.dispose();
        fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
      }
    },
  );
}

it("locked oracle closes actual CKs with pending error and retries before deleting Scratch", async () => {
  const { spawnSync } = await import("node:child_process");
  const sidecar = fileURLToPath(
    new URL("../sidecars/spiceypy", import.meta.url),
  );
  const result = spawnSync(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      sidecar,
      "python",
      "-m",
      "unittest",
      "discover",
      "-s",
      path.join(sidecar, "tests"),
      "-p",
      "test_ck_cleanup.py",
    ],
    { encoding: "utf8" },
  );
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
});
