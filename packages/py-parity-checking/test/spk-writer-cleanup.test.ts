import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import {
  createRunTspiceContext,
  clearKernelState,
  cleanupContext,
} from "../src/run-tspice/context.js";
import { dispatchStep } from "../src/run-tspice/dispatch.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: pending SPK retries before Scratch deletion`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      let attempts = 0;
      const roots: boolean[] = [];
      let root = "";
      const wrapped = {
        ...setup.spice,
        raw: {
          ...setup.spice.raw,
          spkcls: (...args: Parameters<typeof setup.spice.raw.spkcls>) => {
            attempts++;
            roots.push(fs.existsSync(root));
            if (attempts === 1) throw Error("controlled first close failure");
            setup.spice.raw.spkcls(...args);
          },
        },
      };
      const context = createRunTspiceContext(
        wrapped,
        fixtures,
        `spk-cleanup-${backend}`,
      );
      root = context.paths.scratchRoot;
      fs.mkdirSync(root, { recursive: true });
      clearKernelState(context);
      dispatchStep(context, {
        op: "ephemeris.spkopn",
        file: { kind: "scratch", rel: "pending.bsp" },
        ifname: "AUTHORED",
        ncomch: 0,
        handleId: "H",
      });
      dispatchStep(context, {
        op: "ephemeris.spkw08",
        handleId: "H",
        body: 100001,
        center: 0,
        frame: "J2000",
        first: 0,
        last: 60,
        segid: "AUTHORED",
        degree: 1,
        states: [1, 2, 3, 4, 5, 6, 241, 302, 363, 4, 5, 6],
        epoch1: 0,
        step: 60,
      });
      const handle = context.state.ephemeris.spkHandles.get("H");
      if (handle === undefined) throw Error("Missing actual writer");
      try {
        cleanupContext(context);
        expect(attempts).toBe(2);
        expect(roots).toEqual([true, true]);
        expect(context.state.ephemeris.spkHandles.size).toBe(0);
        expect(fs.existsSync(root)).toBe(false);
        expect(() => setup.spice.raw.spkcls(handle)).toThrow(/closed|handle/i);
      } finally {
        await setup.dispose();
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  );
it("locked oracle resets pending error and retries actual SPK close before Scratch deletion", () => {
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
      "test_spk_cleanup.py",
    ],
    { encoding: "utf8" },
  );
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
});
