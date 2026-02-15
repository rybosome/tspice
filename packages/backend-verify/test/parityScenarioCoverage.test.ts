import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { PARITY_SCENARIO_DENYLIST } from "../src/parity/parityScenarioDenylist.js";
import { computeContractKeys, stableCompare } from "../scripts/parity-contract-keys.mjs";

async function computeScenarioCalls(scenariosDir: string): Promise<Set<string>> {
  const scenarioFiles = fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort(stableCompare);

  const calls = new Set<string>();

  for (const file of scenarioFiles) {
    const scenarioPath = path.join(scenariosDir, file);

    const yamlFile = await loadScenarioYamlFile(scenarioPath);
    const scenario = parseScenario(yamlFile);

    for (const c of scenario.cases) {
      calls.add(c.call);
    }
  }

  return calls;
}

describe("backend-verify parity scenario coverage", () => {
  it("covers SpiceBackend contract calls (or explicitly denylisted)", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const scenariosDir = path.resolve(testDir, "../scenarios");

    const contractIndexPath = path.resolve(testDir, "../../backend-contract/src/index.ts");
    const contractDomainsDir = path.resolve(testDir, "../../backend-contract/src/domains");

    const contractKeys = computeContractKeys({ indexPath: contractIndexPath, domainsDir: contractDomainsDir }).sort(
      stableCompare,
    );

    const scenarioCalls = await computeScenarioCalls(scenariosDir);

    const denylist = Array.from(PARITY_SCENARIO_DENYLIST);

    // Nice-to-have: assert denylist itself is deterministic.
    const denylistSorted = [...denylist].sort(stableCompare);
    if (denylist.join("\n") !== denylistSorted.join("\n")) {
      throw new Error(
        [
          "PARITY_SCENARIO_DENYLIST must be sorted (deterministic).",
          "Suggested fix: regenerate via node ./packages/backend-verify/scripts/gen-parity-denylist.mjs --ts",
        ].join("\n"),
      );
    }

    if (new Set(denylist).size !== denylist.length) {
      throw new Error("PARITY_SCENARIO_DENYLIST must not contain duplicates.");
    }

    const contractSet = new Set(contractKeys);
    const denySet = new Set(denylist);

    const unknownDenylist = Array.from(denySet)
      .filter((k) => !contractSet.has(k))
      .sort(stableCompare);

    if (unknownDenylist.length > 0) {
      throw new Error(
        [
          `unknownDenylist (${unknownDenylist.length}) - denylist entries not present in SpiceBackend contract:`,
          ...unknownDenylist.map((k) => `  - ${k}`),
        ].join("\n"),
      );
    }

    const missing = contractKeys.filter((k) => !scenarioCalls.has(k) && !denySet.has(k)).sort(stableCompare);

    if (missing.length > 0) {
      throw new Error(
        [
          `missing (${missing.length}) - SpiceBackend contract methods not covered by parity scenarios:`,
          ...missing.map((k) => `  - ${k}`),
        ].join("\n"),
      );
    }
  });
});
