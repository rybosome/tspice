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

    expect(out.cases.length).toBe(3);

    const j2000 = out.cases.find((c) => c.case.id === "j2000-tdb");
    expect(j2000?.outcome.ok).toBe(true);

    if (j2000?.outcome.ok) {
      expect(typeof j2000.outcome.result).toBe("number");
      // J2000 epoch should be very close to ET=0 when expressed in TDB.
      expect(Math.abs(j2000.outcome.result as number)).toBeLessThan(1e-6);
    }

    const isoUtc = out.cases.find((c) => c.case.id === "iso-utc");
    expect(isoUtc?.outcome.ok).toBe(true);

    const invalid = out.cases.find((c) => c.case.id === "invalid");
    expect(invalid?.outcome.ok).toBe(false);

    if (invalid && !invalid.outcome.ok) {
      expect(typeof invalid.outcome.error.message).toBe("string");
      // Best-effort: when this is a SPICE error, short should be present.
      if (invalid.outcome.error.spice?.short !== undefined) {
        expect(typeof invalid.outcome.error.spice.short).toBe("string");
        expect(invalid.outcome.error.spice.short.length).toBeGreaterThan(0);
      }
    }
  });
});
