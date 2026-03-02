import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadYamlFile } from "../../src/dsl/loadYaml.js";
import { parseMethodSpecAny } from "../../src/dsl/schemaValidate.js";
import { isMethodSpecV2 } from "../../src/dsl/types.js";
import { executeMethodSpecParityV2 } from "../../src/engine/executeMethodSpecV2.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../../src/runners/cspiceRunner.js";
import { createTspiceRunner } from "../../src/runners/tspiceRunner.js";

import type { MethodSpecV2 } from "../../src/dsl/types.js";
import type { CaseRunner } from "../../src/runners/types.js";

const TARGET_METHOD_SPEC_PATHS = [
  "specs/methods/dsk/dskgd@v2.yml",
  "specs/methods/dsk/dskb02@v2.yml",
  "specs/methods/dsk/dskobj@v2.yml",
  "specs/methods/dsk/dsksrf@v2.yml",
  "specs/methods/file-io/dskopn@v2.yml",
  "specs/methods/file-io/dskmi2@v2.yml",
  "specs/methods/file-io/dskw02@v2.yml",
  "specs/methods/file-io/readVirtualOutput@v2.yml",
] as const;

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

async function loadMethodSpec(relativePath: string): Promise<MethodSpecV2> {
  const filePath = path.join(packageRoot(), relativePath);
  const spec = parseMethodSpecAny(await loadYamlFile(filePath));
  if (!isMethodSpecV2(spec)) {
    throw new Error(`Expected v2 method spec at ${relativePath}`);
  }

  return spec;
}

async function withRunners<T>(
  fn: (runners: { tspice: CaseRunner; cspice: CaseRunner }) => Promise<T>,
): Promise<T> {
  const tspice = await createTspiceRunner();
  const cspice = await createCspiceRunner();

  try {
    return await fn({ tspice, cspice });
  } finally {
    await Promise.allSettled([tspice.dispose?.(), cspice.dispose?.()]);
  }
}

describe.sequential("targeted v2 DSK/file parity coverage", () => {
  const status = getCspiceRunnerStatus();
  const maybeIt = status.ready ? it : it.skip;

  maybeIt("executes migrated DSK/file v2 method specs across tspice and cspice", async () => {
    const specs = await Promise.all(TARGET_METHOD_SPEC_PATHS.map((specPath) => loadMethodSpec(specPath)));

    await withRunners(async (runners) => {
      for (const spec of specs) {
        const summary = await executeMethodSpecParityV2(spec, runners);
        expect(summary.caseCount).toBeGreaterThan(0);
      }
    });
  });
});
