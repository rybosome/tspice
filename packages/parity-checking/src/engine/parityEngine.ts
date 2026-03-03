import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverCrossCuttingSpecs, discoverYamlFiles } from "../dsl/discoverCrossCuttingSpecs.js";
import { loadYamlFile } from "../dsl/loadYaml.js";
import { parseCrossCuttingSpecAny, parseMethodSpecAny } from "../dsl/schemaValidate.js";
import { runDispatchAliasParityGuard } from "./dispatchParityGuard.js";
import { executeCrossCuttingSpec } from "./executeCrossCuttingSpec.js";
import { executeMethodSpecParityV2 } from "./executeMethodSpecV2.js";
import { validateCompleteness } from "../guards/validateCompleteness.js";
import { validateCrossCuttingSpecs } from "../guards/validateCrossCuttingSpecs.js";
import { validateDispatchAliasCoverage } from "../guards/validateDispatchAliasCoverage.js";
import { validateSchema } from "../guards/validateSchema.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../runners/cspiceRunner.js";
import { createTspiceRunner } from "../runners/tspiceRunner.js";

import { crossCuttingSpecId, methodSpecId } from "../dsl/types.js";
import type { LoadedParitySpecs, ResolvedMethodSpec } from "../dsl/types.js";
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
  const crossCuttingFiles = discoverCrossCuttingSpecs(path.join(root, "specs", "cross-cutting"));

  const methods = (
    await Promise.all(methodFiles.map(async (filePath) => parseMethodSpecAny(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(methodSpecId(a), methodSpecId(b)));

  const crossCutting = (
    await Promise.all(
      crossCuttingFiles.map(async (filePath) => parseCrossCuttingSpecAny(await loadYamlFile(filePath))),
    )
  ).sort((a, b) => stableSort(crossCuttingSpecId(a), crossCuttingSpecId(b)));

  return {
    workflows: [],
    methods,
    crossCutting,
  };
}

export type ParityEngineSummary = {
  skipped: boolean;
  skipReason?: string;
  workflowCount: number;
  methodCount: number;
  crossCuttingSpecCount: number;
  contractCount: number;
  coveredCount: number;
  denylistCount: number;
  aliasCount: number;
  aliasGuardValidatedCount: number;
  methodCaseCount: number;
  crossCuttingCaseCount: number;
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

async function withTspiceRunner<T>(fn: (runner: CaseRunner) => Promise<T>): Promise<T> {
  let tspice: CaseRunner | undefined;

  try {
    tspice = await createTspiceRunner();
    return await fn(tspice);
  } finally {
    await tspice?.dispose?.();
  }
}

/** Run parity validation across dispatch aliases, cross-cutting specs, and method specs. */
export async function runParityEngine(): Promise<ParityEngineSummary> {
  const specs = await loadParitySpecs();

  validateSchema(specs);

  const completeness = validateCompleteness(specs.methods);
  validateCrossCuttingSpecs(specs.crossCutting);
  const aliasCoverage = validateDispatchAliasCoverage();

  const resolvedMethods: ResolvedMethodSpec[] = specs.methods.map((method) => ({
    method,
    includeOrder: [],
    ...(method.setup !== undefined ? { mergedSetup: method.setup } : {}),
    ...(method.defaults?.compare !== undefined ? { mergedCompareDefaults: method.defaults.compare } : {}),
  }));

  const status = getCspiceRunnerStatus();
  if (!status.ready) {
    return {
      skipped: true,
      skipReason: `cspice-runner unavailable: ${status.hint}`,
      workflowCount: 0,
      methodCount: specs.methods.length,
      crossCuttingSpecCount: specs.crossCutting.length,
      contractCount: completeness.contractCount,
      coveredCount: completeness.coveredCount,
      denylistCount: completeness.denylistCount,
      aliasCount: aliasCoverage.aliasCount,
      aliasGuardValidatedCount: 0,
      methodCaseCount: 0,
      crossCuttingCaseCount: 0,
    };
  }

  const paritySummary = await withRunners(async (runners) => {
    let crossCuttingCaseCount = 0;
    for (const spec of specs.crossCutting) {
      const summary = await executeCrossCuttingSpec(spec);
      crossCuttingCaseCount += summary.caseCount;
    }

    let methodCaseCount = 0;
    for (const method of specs.methods) {
      const summary = await executeMethodSpecParityV2(method, runners);
      methodCaseCount += summary.caseCount;
    }

    return {
      skipped: false,
      workflowCount: 0,
      methodCount: specs.methods.length,
      crossCuttingSpecCount: specs.crossCutting.length,
      contractCount: completeness.contractCount,
      coveredCount: completeness.coveredCount,
      denylistCount: completeness.denylistCount,
      aliasCount: aliasCoverage.aliasCount,
      aliasGuardValidatedCount: 0,
      methodCaseCount,
      crossCuttingCaseCount,
    };
  });

  const aliasGuard = await withTspiceRunner(async (tspiceRunner) =>
    runDispatchAliasParityGuard(resolvedMethods, tspiceRunner),
  );

  return {
    ...paritySummary,
    aliasGuardValidatedCount: aliasGuard.validatedAliasCount,
  };
}
