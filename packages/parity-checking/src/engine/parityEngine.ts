import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverYamlFiles } from "../dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../dsl/loadYaml.js";
import { parseMethodSpec } from "../dsl/schemaValidate.js";
import { executeMethodSpecParityV2 } from "./executeMethodSpecV2.js";
import { validateCompleteness } from "../guards/validateCompleteness.js";
import { validateSchema } from "../guards/validateSchema.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../runners/cspiceRunner.js";
import { createTspiceRunner } from "../runners/tspiceRunner.js";

import { methodSpecId } from "../dsl/types.js";
import type { LoadedParitySpecs } from "../dsl/types.js";
import type { CaseRunner } from "../runners/types.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function loadParitySpecs(): Promise<LoadedParitySpecs> {
  const root = packageRoot();

  const methodFiles = discoverYamlFiles(path.join(root, "specs", "methods"));

  const methods = (
    await Promise.all(methodFiles.map(async (filePath) => parseMethodSpec(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(methodSpecId(a), methodSpecId(b)));

  return {
    workflows: [],
    methods,
  };
}

export type ParityEngineSummary = {
  skipped: boolean;
  skipReason?: string;
  workflowCount: number;
  methodCount: number;
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
  methodCaseCount: number;
};

async function withRunners<T>(
  fn: (runners: { tspice: CaseRunner; cspice: CaseRunner }) => Promise<T>,
): Promise<T> {
  let tspice: CaseRunner | undefined;
  let cspice: CaseRunner | undefined;

  try {
    tspice = await createTspiceRunner();
    cspice = await createCspiceRunner();

    return await fn({ tspice, cspice });
  } finally {
    await Promise.allSettled([tspice?.dispose?.(), cspice?.dispose?.()]);
  }
}

/** Run parity validation across method specs. */
export async function runParityEngine(): Promise<ParityEngineSummary> {
  const specs = await loadParitySpecs();

  validateSchema(specs);

  const completeness = validateCompleteness(specs.methods);

  const status = getCspiceRunnerStatus();
  if (!status.ready) {
    return {
      skipped: true,
      skipReason: `cspice-runner unavailable: ${status.hint}`,
      workflowCount: 0,
      methodCount: specs.methods.length,
      contractCount: completeness.contractCount,
      coveredCount: completeness.coveredCount,
      denylistCount: completeness.denylistCount,
      methodCaseCount: 0,
    };
  }

  const paritySummary = await withRunners(async (runners) => {
    let methodCaseCount = 0;
    for (const method of specs.methods) {
      const summary = await executeMethodSpecParityV2(method, runners);
      methodCaseCount += summary.caseCount;
    }

    return {
      skipped: false,
      workflowCount: 0,
      methodCount: specs.methods.length,
      contractCount: completeness.contractCount,
      coveredCount: completeness.coveredCount,
      denylistCount: completeness.denylistCount,
      methodCaseCount,
    };
  });

  return paritySummary;
}
