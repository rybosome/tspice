import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadYamlFile } from "../../src/dsl/loadYaml.js";
import { parseMethodSpec } from "../../src/dsl/schemaValidate.js";
import { executeMethodSpecParityV2 } from "../../src/engine/executeMethodSpecV2.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";

import type { MethodSpecV2 } from "../../src/dsl/types.js";
import type { CaseRunner } from "../../src/runners/types.js";

const TARGET_METHOD_SPEC_PATHS = [
  "specs/methods/dsk/dskgd@v3.yml",
  "specs/methods/dsk/dskb02@v3.yml",
  "specs/methods/dsk/dskobj@v3.yml",
  "specs/methods/dsk/dsksrf@v3.yml",
] as const;

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

async function loadMethodSpec(relativePath: string): Promise<MethodSpecV2> {
  const filePath = path.join(packageRoot(), relativePath);
  return parseMethodSpec(await loadYamlFile(filePath));
}

async function withRunners<T>(
  call: (runners: { tspice: CaseRunner; cspice: CaseRunner }) => Promise<T>,
): Promise<T> {
  const tspice = await createTspiceRunner();
  const cspice = await createCspiceRunner();

  try {
    return await call({ tspice, cspice });
  } finally {
    await Promise.allSettled([tspice.dispose?.(), cspice.dispose?.()]);
  }
}

describe.sequential("targeted v3 DSK/file parity coverage", () => {
  const status = getCspiceRunnerStatus();
  const maybeIt = status.ready ? it : it.skip;

  maybeIt("executes migrated DSK/file v3 method specs across tspice and cspice", async () => {
    const specs = await Promise.all(TARGET_METHOD_SPEC_PATHS.map((specPath) => loadMethodSpec(specPath)));

    await withRunners(async (runners) => {
      for (const spec of specs) {
        const summary = await executeMethodSpecParityV2(spec, runners);
        expect(summary.caseCount).toBeGreaterThan(0);
      }
    });
  });
});
