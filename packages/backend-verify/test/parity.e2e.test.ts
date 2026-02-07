import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import {
  createCspiceRunner,
  getCspiceRunnerBuildStatePath,
  isCspiceRunnerAvailable,
  readCspiceRunnerBuildState,
} from "../src/runners/cspiceRunner.js";
import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { executeScenario } from "../src/dsl/execute.js";
import { compareValues } from "../src/compare/compare.js";
import { formatMismatchReport } from "../src/compare/report.js";

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

function cspiceRunnerReady(): boolean {
  if (!isCspiceRunnerAvailable()) {
    const statePath = getCspiceRunnerBuildStatePath();
    const state = readCspiceRunnerBuildState();

    const hint =
      state?.reason ||
      state?.error ||
      (fs.existsSync(statePath)
        ? `cspice-runner unavailable (see ${statePath})`
        : `cspice-runner unavailable (missing ${statePath})`);

    // eslint-disable-next-line no-console
    console.error(`[backend-verify] skipping cspice parity test: ${hint}`);
    return false;
  }

  const state = readCspiceRunnerBuildState();
  if (state?.available === false) {
    // eslint-disable-next-line no-console
    console.error(`[backend-verify] skipping cspice parity test: ${state.reason || state.error}`);
    return false;
  }

  return true;
}

describe("backend-verify (tspice vs cspice parity)", () => {
  const maybeIt = hasNodeBackendDist() && cspiceRunnerReady() ? it : it.skip;

  maybeIt("matches time.str2et basic scenario", async () => {
    const scenarioPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../scenarios/time.str2et.basic.yml",
    );

    const yamlFile = await loadScenarioYamlFile(scenarioPath);
    const scenario = parseScenario(yamlFile);

    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    const tspiceOut = await executeScenario(scenario, tspice);
    const cspiceOut = await executeScenario(scenario, cspice);

    expect(tspiceOut.cases.length).toBe(cspiceOut.cases.length);

    for (let i = 0; i < tspiceOut.cases.length; i++) {
      const t = tspiceOut.cases[i]!;
      const c = cspiceOut.cases[i]!;

      const label = `${scenario.name ?? path.basename(scenarioPath)} case=${t.case.id} call=${t.case.call}`;

      if (t.outcome.ok !== c.outcome.ok) {
        throw new Error(
          [
            `Outcome mismatch (${label}):`,
            `  tspice ok=${t.outcome.ok} ${t.outcome.ok ? "" : `error=${JSON.stringify(t.outcome.error)}`}`,
            `  cspice ok=${c.outcome.ok} ${c.outcome.ok ? "" : `error=${JSON.stringify(c.outcome.error)}`}`,
          ].join("\n"),
        );
      }

      if (!t.outcome.ok || !c.outcome.ok) {
        // Both failed. For now, just assert we got errors from both sides.
        expect(t.outcome.ok).toBe(false);
        expect(c.outcome.ok).toBe(false);
        continue;
      }

      // cspice is the reference.
      const cmp = compareValues(t.outcome.result, c.outcome.result, { tolAbs: 1e-12, tolRel: 1e-12 });
      if (!cmp.ok) {
        const report = formatMismatchReport(cmp.mismatches);
        throw new Error(`Result mismatch (${label}):\n${report}`);
      }
    }
  });
});
