import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { executeScenario } from "../src/dsl/execute.js";

const require = createRequire(import.meta.url);

function hasNodeBackendDist(): boolean {
  try {
    // In JS-only CI we typically don't build the native backend package.
    // If its dist entry doesn't exist, skip this e2e test.
    require.resolve("@rybosome/tspice-backend-node");
    return true;
  } catch {
    return false;
  }
}

describe("backend-verify (tspice runner)", () => {
  const maybeIt = hasNodeBackendDist() ? it : it.skip;

  maybeIt("runs time.str2et basic scenario", async () => {
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
      // J2000 epoch should be very close to ET=0 with the leapseconds kernel loaded.
      expect(Math.abs(case0.outcome.result as number)).toBeLessThan(1e-6);
    }
  });
});
