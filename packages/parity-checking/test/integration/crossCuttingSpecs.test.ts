import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { executeCrossCuttingSpec } from "../../src/engine/executeCrossCuttingSpec.js";
import { discoverCrossCuttingSpecs } from "../../src/dsl/discoverCrossCuttingSpecs.js";
import { parseCrossCuttingSpec } from "../../src/dsl/schemaValidate.js";
import { getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";

describe("cross-cutting spec discovery and execution", () => {
  it("discovers and executes all cross-cutting yaml specs", async () => {
    const status = getCspiceRunnerStatus();
    if (!status.ready && process.env.TSPICE_BACKEND_VERIFY_REQUIRED !== "true") {
      // eslint-disable-next-line no-console
      console.warn(`[parity-checking] cspice-runner unavailable; skipping cross-cutting integration test: ${status.hint}`);
      return;
    }

    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const rootDir = path.resolve(testDir, "../../specs/cross-cutting");

    const files = discoverCrossCuttingSpecs(rootDir);
    expect(files.length).toBeGreaterThan(0);

    let executedCases = 0;
    for (const filePath of files) {
      const spec = parseCrossCuttingSpec({
        sourcePath: filePath,
        data: parseYaml(fs.readFileSync(filePath, "utf8")),
      });

      const summary = await executeCrossCuttingSpec(spec);
      executedCases += summary.caseCount;
    }

    expect(executedCases).toBeGreaterThan(0);
  });
});
