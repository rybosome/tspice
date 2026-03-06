import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { executeCrossCuttingSpec } from "../../src/engine/executeCrossCuttingSpec.js";
import { discoverYamlFiles } from "../../src/dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../../src/dsl/loadYaml.js";
import { parseCrossCuttingSpec } from "../../src/dsl/schemaValidate.js";
import { getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";

describe("cross-cutting spec discovery and execution", () => {
  it("discovers and executes all cross-cutting yaml specs", async () => {
    const status = getCspiceRunnerStatus();
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const rootDir = path.resolve(testDir, "../../specs/cross-cutting");

    const files = discoverYamlFiles(rootDir);
    expect(files.length).toBeGreaterThan(0);

    let executedCases = 0;
    let skippedSpecs = 0;
    for (const filePath of files) {
      const spec = parseCrossCuttingSpec(await loadYamlFile(filePath));

      const summary = await executeCrossCuttingSpec(spec);
      if (summary.skipped) {
        skippedSpecs++;
        expect(summary.skipReason).toMatch(/^cspice-runner unavailable:/);
        continue;
      }

      executedCases += summary.caseCount;
    }

    if (!status.ready) {
      expect(skippedSpecs).toBe(files.length);
      expect(executedCases).toBe(0);
      return;
    }

    expect(skippedSpecs).toBe(0);
    expect(executedCases).toBeGreaterThan(0);
  });
});
