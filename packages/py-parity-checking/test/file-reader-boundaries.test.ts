import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/kernels",
);

describe("reader handle errors and same-instance recovery", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(backend, async () => {
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      let daf: SpiceHandle | undefined;
      let das: SpiceHandle | undefined;
      try {
        raw.kclear();
        raw.furnsh({
          path: "audit.bsp",
          bytes: fs.readFileSync(path.join(fixtures, "audit-two-segment.bsp")),
        });
        raw.furnsh({
          path: "audit.bds",
          bytes: fs.readFileSync(path.join(fixtures, "file-io-minimal.bds")),
        });
        daf = raw.dafopr("audit.bsp");
        expect(() => raw.daffna(daf!)).toThrow(/DAFNOSEARCH/);
        raw.dafbfs(daf);
        expect(raw.daffna(daf)).toBe(true);
        das = raw.dasopr("audit.bds");
        // Wrong-kind operations must reject before closing or changing the owner.
        for (const use of [raw.dafcls, raw.dafbfs, raw.daffna])
          expect(() => use(das!)).toThrow(/kind/);
        for (const use of [raw.dascls, raw.dlacls, raw.dlabfs])
          expect(() => use(daf!)).toThrow(/kind/);
        for (const invalid of [
          0,
          -1,
          NaN,
          Infinity,
          Number(daf) + 0.5,
          Number(daf) >>> 0,
        ])
          expect(() => raw.dafbfs(invalid as SpiceHandle)).toThrow();
        expect(raw.dlabfs(das).found).toBe(true);
        expect(raw.daffna(daf)).toBe(true);
        const expiredDaf = daf;
        raw.dafcls(daf);
        daf = undefined;
        for (const use of [raw.dafcls, raw.dafbfs, raw.daffna])
          expect(() => use(expiredDaf)).toThrow(/invalid|closed/);
        daf = raw.dafopr("audit.bsp");
        expect(() => raw.dafbfs(expiredDaf)).toThrow(/invalid|closed/);
        raw.dafbfs(daf);
        expect(raw.daffna(daf)).toBe(true);
        const expiredDas = das;
        raw.dlacls(das);
        das = undefined;
        for (const use of [raw.dascls, raw.dlacls, raw.dlabfs])
          expect(() => use(expiredDas)).toThrow(/invalid|closed/);
        das = raw.dasopr("audit.bds");
        expect(raw.dlabfs(das).found).toBe(true);
        expect(raw.failed()).toBe(false);
      } finally {
        if (daf !== undefined) raw.dafcls(daf);
        if (das !== undefined) raw.dascls(das);
        raw.kclear();
        await setup.dispose();
      }
    });
});
