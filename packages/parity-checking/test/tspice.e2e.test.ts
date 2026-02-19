import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { parseMethodSpec, parseWorkflowSpec } from "../src/dsl/schemaValidate.js";
import { mergeResolvedMethodSpec } from "../src/dsl/mergeResolvedSpec.js";
import { executeMethodSpecParity } from "../src/engine/executeMethodSpec.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

describe("parity-checking method execution", () => {
  it("executes str2et method spec parity", async () => {
    const status = getCspiceRunnerStatus();
    if (!status.ready) {
      throw new Error(
        `[parity-checking] cspice-runner unavailable: ${status.hint}. ` +
          `Remediation: ensure CSPICE is available (pnpm -w fetch:cspice) and rebuild (pnpm test:verify). ` +
          `State: ${status.statePath}`,
      );
    }

    const methodPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../specs/methods/time/str2et@v1.yml",
    );

    const method = parseMethodSpec({
      sourcePath: methodPath,
      data: parseYaml(fs.readFileSync(methodPath, "utf8")),
    });

    const workflowPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../workflows/legacy/time.str2et.basic@v1.yml",
    );

    const workflow = parseWorkflowSpec({
      sourcePath: workflowPath,
      data: parseYaml(fs.readFileSync(workflowPath, "utf8")),
    });

    const resolved = mergeResolvedMethodSpec(method, [workflow]);

    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    try {
      const summary = await executeMethodSpecParity(resolved, { tspice, cspice });
      expect(summary.caseCount).toBeGreaterThan(0);
      expect(summary.methodId).toBe("methods/time/str2et@v1");
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });
});
