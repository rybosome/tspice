import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: literal packed integer assertions detect a one-bit body defect`,
    async () => {
      const setup = await spiceClients.toSync({ backend });
      try {
        const c = allCases.find(
          (x) => x.caseId === "ephemeris-spkpds-audit-signed-negative-center",
        );
        if (!c) throw Error("missing descriptor case");
        const oracle = await runCaseInSidecar(c, fixtures),
          actual = runCaseInTspice(setup.spice, c, fixtures);
        for (const r of [oracle, actual]) {
          expect(r.ok).toBe(true);
          expect(r.outputs[0]?.value).toEqual({
            first: -123.5,
            last: 456.75,
            packedIntegers: [-123456, -42, 17, 8, 0, 0],
          });
        }
        const raw = setup.spice.raw;
        const wrong = {
          ...setup.spice,
          raw: {
            ...raw,
            spkpds: (...args: Parameters<typeof raw.spkpds>) =>
              raw.spkpds(
                args[0] + 1,
                args[1],
                args[2],
                args[3],
                args[4],
                args[5],
              ),
          },
        };
        const incorrect = runCaseInTspice(wrong, c, fixtures);
        expect(incorrect.ok).toBe(true);
        expect(() => assertCaseParity(c, oracle, incorrect)).toThrow();
        const addresses = allCases.find(
          (x) =>
            x.caseId ===
            "ephemeris-spkuds-audit-full-addresses-and-negative-body",
        );
        if (!addresses) throw Error("missing address case");
        for (const r of [
          await runCaseInSidecar(addresses, fixtures),
          runCaseInTspice(setup.spice, addresses, fixtures),
        ]) {
          expect(r.ok).toBe(true);
          expect(r.outputs[0]?.value).toEqual({
            body: -123456,
            center: 399,
            frame: 17,
            type: 8,
            first: -12.5,
            last: 44.25,
            baddr: 513,
            eaddr: 1234567,
          });
        }
      } finally {
        await setup.dispose();
      }
    },
  );
