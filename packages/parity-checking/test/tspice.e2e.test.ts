import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { parseMethodSpec } from "../src/dsl/schemaValidate.js";
import { mergeResolvedMethodSpec } from "../src/dsl/mergeResolvedSpec.js";
import { executeMethodSpecParity } from "../src/engine/executeMethodSpec.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

describe("parity-checking method execution", () => {
  it("executes str2et method spec parity", async () => {
    const status = getCspiceRunnerStatus();
    if (!status.ready && process.env.TSPICE_BACKEND_VERIFY_REQUIRED !== "true") {
      // eslint-disable-next-line no-console
      console.warn(`[parity-checking] cspice-runner unavailable; skipping tspice.e2e: ${status.hint}`);
      return;
    }

    const methodPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../specs/methods/time/str2et@v1.yml",
    );

    const method = parseMethodSpec({
      sourcePath: methodPath,
      data: parseYaml(fs.readFileSync(methodPath, "utf8")),
    });

    const resolved = mergeResolvedMethodSpec(method, []);

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
