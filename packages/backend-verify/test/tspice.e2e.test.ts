import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { executeScenario } from "../src/dsl/execute.js";

describe("backend-verify (tspice runner)", () => {
  it("runs time.str2et basic scenario", async () => {
    const scenarioPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../scenarios/time.str2et.basic.yml",
    );

    const yamlFile = await loadScenarioYamlFile(scenarioPath);
    const scenario = parseScenario(yamlFile);

    const runner = await createTspiceRunner();
    const out = await executeScenario(scenario, runner);

    expect(out.cases.length).toBe(1);

    const case0 = out.cases[0];
    expect(case0?.outcome.ok).toBe(true);

    if (case0?.outcome.ok) {
      expect(typeof case0.outcome.result).toBe("number");
      // J2000 epoch should be very close to ET=0 when expressed in TDB.
      expect(Math.abs(case0.outcome.result as number)).toBeLessThan(1e-6);
    }
  });
});
