import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadYamlFile } from "../src/dsl/loadYaml.js";
import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { parseMethodSpec } from "../src/dsl/schemaValidate.js";
import { executeMethodSpecParity } from "../src/engine/executeMethodSpec.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

describe("parity-checking method execution", () => {
  const status = getCspiceRunnerStatus();
  const maybeIt = status.ready ? it : it.skip;

  maybeIt("executes tkvrsn method spec parity", async () => {
    const methodPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../specs/methods/time/tkvrsn@v3.yml",
    );

    const method = parseMethodSpec(await loadYamlFile(methodPath));

    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    try {
      const summary = await executeMethodSpecParity(method, { tspice, cspice });
      expect(summary.caseCount).toBeGreaterThan(0);
      expect(summary.methodId).toBe("methods/time/tkvrsn@v3");
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });
});
