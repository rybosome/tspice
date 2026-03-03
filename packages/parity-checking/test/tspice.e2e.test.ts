import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { createTspiceRunner } from "../src/runners/tspiceRunner.js";
import { parseMethodSpec } from "../src/dsl/schemaValidate.js";
import { executeMethodSpecParity } from "../src/engine/executeMethodSpec.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../src/runners/cspiceRunner.js";

describe("parity-checking method execution", () => {
  const status = getCspiceRunnerStatus();
  const maybeIt = status.ready ? it : it.skip;

  maybeIt("executes str2et method spec parity", async () => {
    const methodPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../specs/methods/time/str2et@v3.yml",
    );

    const method = parseMethodSpec({
      sourcePath: methodPath,
      data: parseYaml(fs.readFileSync(methodPath, "utf8")),
    });

    const tspice = await createTspiceRunner();
    const cspice = await createCspiceRunner();

    try {
      const summary = await executeMethodSpecParity(method, { tspice, cspice });
      expect(summary.caseCount).toBeGreaterThan(0);
      expect(summary.methodId).toBe("methods/time/str2et@v3");
    } finally {
      await tspice.dispose?.();
      await cspice.dispose?.();
    }
  });
});
