import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, vi } from "vitest";

import { spiceClients } from "@rybosome/tspice";

import { allCases } from "../src/cases/index.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "..", "fixtures");

// CI runners can take longer to spawn Python sidecar calls for parity checks.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 });

describe("py-parity-checking", () => {
  for (const parityCase of allCases) {
    it(parityCase.caseId, async () => {
      const sidecarResult = await runCaseInSidecar(parityCase, fixturesRoot);

      const setup = await spiceClients.toSync({ backend: "wasm" });
      try {
        const tspiceResult = runCaseInTspice(
          setup.spice,
          parityCase,
          fixturesRoot,
        );

        assertCaseParity(parityCase, sidecarResult, tspiceResult);
      } finally {
        await setup.dispose();
      }
    });
  }
});
