import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, vi } from "vitest";

import { spiceClients } from "@rybosome/tspice";

import { allCases } from "../src/cases/index.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "..", "fixtures");

// CI runners can take longer to spawn Python sidecar calls for parity checks.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 });

async function assertParityForBackend(
  parityCase: (typeof allCases)[number],
  backend: "wasm" | "node",
): Promise<void> {
  const sidecarResult = await runCaseInSidecar(parityCase, fixturesRoot);

  const setup = await spiceClients.toSync({ backend });
  try {
    const tspiceResult = runCaseInTspice(setup.spice, parityCase, fixturesRoot);

    assertCaseParity(parityCase, sidecarResult, tspiceResult);
  } finally {
    await setup.dispose();
  }
}

describe("py-parity-checking", () => {
  const itNode = it.runIf(nodeBackendAvailable);

  for (const parityCase of allCases) {
    it(parityCase.caseId, async () => {
      await assertParityForBackend(parityCase, "wasm");
    });

    itNode(`${parityCase.caseId} [node]`, async () => {
      await assertParityForBackend(parityCase, "node");
    });
  }
});
