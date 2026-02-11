import * as path from "node:path";
import * as fs from "node:fs";

import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CaseRunner } from "../src/runners/types.js";
import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import {
  createCspiceRunner,
  getCspiceRunnerStatus,
} from "../src/runners/cspiceRunner.js";
import { loadScenarioYamlFile } from "../src/dsl/load.js";
import { parseScenario } from "../src/dsl/parse.js";
import { executeScenario } from "../src/dsl/execute.js";
import { compareValues } from "../src/compare/compare.js";
import { formatMismatchReport } from "../src/compare/report.js";
import { spiceShortSymbol } from "../src/errors/spiceShort.js";

const DEFAULT_TOL_ABS = 1e-12;
const DEFAULT_TOL_REL = 1e-12;

function isRequired(): boolean {
  return process.env.TSPICE_BACKEND_VERIFY_REQUIRED === "true";
}

describe.sequential("backend-verify (tspice vs raw CSPICE parity)", () => {
  let tspice: CaseRunner | undefined;
  let cspice: CaseRunner | undefined;

  it("cspice-runner availability", () => {
    const status = getCspiceRunnerStatus();
    if (status.ready) return;

    if (!isRequired()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[backend-verify] cspice-runner unavailable; backend-verify parity suite may be skipped (TSPICE_BACKEND_VERIFY_REQUIRED=false): ${status.hint}`,
      );
      return;
    }

    throw new Error(
      `[backend-verify] cspice-runner required but unavailable: ${status.hint}. ` +
        `Remediation: ensure CSPICE is available (pnpm -w fetch:cspice) and rebuild (pnpm test:verify). ` +
        `State: ${status.statePath}`,
    );
  });

  // We reuse a single runner instance across scenarios for speed.
  // This is safe because `tspice.runCase()` isolates each case via kernel
  // cleanup/reset (kclear/reset) before executing.
  beforeAll(async () => {
    const status = getCspiceRunnerStatus();
    if (!status.ready) return;

    try {
      tspice = await createTspiceRunner();
      cspice = await createCspiceRunner();
    } catch (error) {
      await Promise.allSettled([tspice?.dispose?.(), cspice?.dispose?.()]);
      throw error;
    }
  });

  afterAll(async () => {
    await tspice?.dispose?.();
    await cspice?.dispose?.();
  });

  const scenariosDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scenarios");
  const scenarioFiles = fs
    .readdirSync(scenariosDir)
    .filter((f) => f.endsWith(".yml"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const file of scenarioFiles) {
    it(`matches scenario ${file}`, async (ctx) => {
      const cspiceStatus = getCspiceRunnerStatus();
      if (!cspiceStatus.ready) ctx.skip();
      const scenarioPath = path.join(scenariosDir, file);

      const yamlFile = await loadScenarioYamlFile(scenarioPath);
      const scenario = parseScenario(yamlFile);

      if (!tspice || !cspice) {
        throw new Error("backend-verify runners not initialized (unexpected): tspice/cspice undefined");
      }

      const tspiceOut = await executeScenario(scenario, tspice);
      const cspiceOut = await executeScenario(scenario, cspice);

      expect(tspiceOut.cases.length).toBe(cspiceOut.cases.length);

      for (let i = 0; i < tspiceOut.cases.length; i++) {
        const t = tspiceOut.cases[i]!;
        const c = cspiceOut.cases[i]!;

        const compare = { ...(scenario.compare ?? {}), ...(t.case.compare ?? {}) };

        const tolAbs = compare.tolAbs ?? DEFAULT_TOL_ABS;
        const tolRel = compare.tolRel ?? DEFAULT_TOL_REL;
        const angleWrapPi = compare.angleWrapPi;
        const errorShort = compare.errorShort ?? false;

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
          // Both failed.
          if (errorShort) {
            const tShort = t.outcome.error.spice?.short;
            const cShort = c.outcome.error.spice?.short;

            if (typeof tShort !== "string" || tShort.trim() === "") {
              throw new Error(`Missing tspice spice.short while comparing errors (${label}): ${JSON.stringify(t.outcome.error)}`);
            }
            if (typeof cShort !== "string" || cShort.trim() === "") {
              throw new Error(`Missing cspice spice.short while comparing errors (${label}): ${JSON.stringify(c.outcome.error)}`);
            }

            const tSymbol = spiceShortSymbol(tShort);
            const cSymbol = spiceShortSymbol(cShort);

            if (tSymbol === null || cSymbol === null) {
              throw new Error(
                [
                  `errorShort enabled but could not extract spice short symbol (${label}):`,
                  `  tspice short=${JSON.stringify(tShort)} symbol=${JSON.stringify(tSymbol)}`,
                  `  cspice short=${JSON.stringify(cShort)} symbol=${JSON.stringify(cSymbol)}`,
                ].join("\n"),
              );
            }

            expect(tSymbol).toBe(cSymbol);
            continue;
          }

          const cmp = compareValues(t.outcome.error, c.outcome.error, { tolAbs, tolRel, angleWrapPi });
          if (!cmp.ok) {
            const report = formatMismatchReport(cmp.mismatches);
            throw new Error(`Error mismatch (${label}):\n${report}`);
          }
          continue;
        }

        // Both succeeded.
        // cspice is the reference.
        const cmp = compareValues(t.outcome.result, c.outcome.result, { tolAbs, tolRel, angleWrapPi });
        if (!cmp.ok) {
          const report = formatMismatchReport(cmp.mismatches);
          throw new Error(`Result mismatch (${label}):\n${report}`);
        }
      }
    });
  }
});
