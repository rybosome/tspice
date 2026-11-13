import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);
describe("spatial-index evidence beyond the former eight-element summaries", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      backend,
      async () => {
        const c = allCases.find(
          (c) => c.caseId === "file-io-dskmi2-minimal-mesh-success",
        );
        if (!c) throw new Error("Missing registered dskmi2 scenario");
        const expected = await runCaseInSidecar(c, fixtures);
        const setup = await spiceClients.toSync({ backend });
        try {
          const actual = runCaseInTspice(setup.spice, c, fixtures);
          assertCaseParity(c, expected, actual);
          if (!actual.ok) throw new Error("Actual raw spatial index failed");
          for (const [component, index] of [
            ["spaixd", 9],
            ["spaixi", 100007],
          ] as const) {
            const corrupted = structuredClone(actual);
            const result = corrupted.outputs.find(
              (output) => output.op === "file-io.dskmi2",
            );
            if (!result || result.op !== "file-io.dskmi2")
              throw new Error("Missing full index observation");
            expect(result.value[component].length).toBeGreaterThan(index);
            result.value[component][index] =
              result.value[component][index]! + 1;
            expect(() => assertCaseParity(c, expected, corrupted)).toThrow(
              /Output mismatch/,
            );
          }
        } finally {
          await setup.dispose();
        }
      },
      20000,
    );
});
