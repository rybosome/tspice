import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, it, vi } from "vitest";

import type { Spice } from "@rybosome/tspice";
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

let spice: Spice;
let dispose: () => Promise<void>;

describe("py-parity-checking", () => {
  beforeAll(async () => {
    const setup = await spiceClients.toSync({ backend: "wasm" });
    spice = setup.spice;
    dispose = setup.dispose;
  });

  afterAll(async () => {
    await dispose();
  });

  for (const parityCase of allCases) {
    it(parityCase.caseId, async () => {
      const sidecarResult = await runCaseInSidecar(parityCase, fixturesRoot);
      const tspiceResult = runCaseInTspice(spice, parityCase, fixturesRoot);

      assertCaseParity(parityCase, sidecarResult, tspiceResult);
    });
  }
});
