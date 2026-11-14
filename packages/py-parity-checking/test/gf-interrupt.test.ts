import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend + " observes interrupt transitions on a cached client after resets",
    async () => {
      const setup = await spiceClients.caching({}).toSync({ backend });
      const raw = setup.spice.raw;
      try {
        raw.gfclrh();
        expect(raw.gfbail()).toBe(false);
        raw.gfinth(2);
        raw.reset();
        raw.kclear();
        expect(raw.gfbail()).toBe(true);
        raw.gfclrh();
        expect(raw.gfbail()).toBe(false);
        raw.gfinth(2);
        expect(raw.gfbail()).toBe(true);
        expect(() => raw.gfinth(15)).toThrow(/INVALIDSIGNAL/);
        expect(raw.gfbail()).toBe(true);
        expect(() => raw.gfinth(2.5)).toThrow();
        expect(() => raw.gfinth(2 ** 31)).toThrow();
        expect(() => raw.gfrepu(4, 3, 3)).toThrow(/BADENDPOINTS/);
        expect(() => raw.gfrepu(3, 3, 4)).toThrow(/VALUEOUTOFRANGE/);
        expect(() => raw.gfrepu(3, 4, NaN)).toThrow(/finite/);
        raw.gfrepu(3, 3, 3);
        expect(raw.failed()).toBe(false);
      } finally {
        raw.gfclrh();
        await setup.dispose();
      }
    },
  );
}
it.runIf(nodeBackendAvailable)(
  "native SIGINT reaches the GF indicator and disposal restores the prior host handler",
  () => {
    const probe = fileURLToPath(
      new URL("./fixtures/gf-signal-probe.mjs", import.meta.url),
    );
    const result = spawnSync(process.execPath, [probe], {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal, result.stderr).toBeNull();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("restored host listener");
  },
);
it("WASM interrupt state is isolated by module instance", async () => {
  const a = await spiceClients.toSync({ backend: "wasm" }),
    b = await spiceClients.toSync({ backend: "wasm" });
  try {
    a.spice.raw.gfinth(2);
    expect(a.spice.raw.gfbail()).toBe(true);
    expect(b.spice.raw.gfbail()).toBe(false);
    b.spice.raw.gfclrh();
    expect(a.spice.raw.gfbail()).toBe(true);
  } finally {
    a.spice.raw.gfclrh();
    await a.dispose();
    await b.dispose();
  }
});
