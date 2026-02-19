import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { buildWorkflowIndex } from "../dsl/buildWorkflowIndex.js";
import { discoverCrossCuttingSpecs, discoverYamlFiles } from "../dsl/discoverCrossCuttingSpecs.js";
import { loadYamlFile } from "../dsl/loadYaml.js";
import { mergeResolvedMethodSpec } from "../dsl/mergeResolvedSpec.js";
import { resolveMethodIncludes } from "../dsl/resolveIncludes.js";
import {
  parseCrossCuttingSpec,
  parseMethodSpec,
  parseWorkflowSpec,
} from "../dsl/schemaValidate.js";
import { runDispatchAliasParityGuard } from "./dispatchParityGuard.js";
import { executeCrossCuttingSpec } from "./executeCrossCuttingSpec.js";
import { executeMethodSpecParity } from "./executeMethodSpec.js";
import { validateCompleteness } from "../guards/validateCompleteness.js";
import { validateCrossCuttingSpecs } from "../guards/validateCrossCuttingSpecs.js";
import { validateDispatchAliasCoverage } from "../guards/validateDispatchAliasCoverage.js";
import { validateIncludeGraph } from "../guards/validateIncludeGraph.js";
import { validateSchema } from "../guards/validateSchema.js";
import { createCspiceRunner, getCspiceRunnerStatus } from "../runners/cspiceRunner.js";
import { createTspiceRunner } from "../runners/tspiceRunner.js";

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

  const workflowFiles = discoverYamlFiles(path.join(root, "workflows"));
  const methodFiles = discoverYamlFiles(path.join(root, "specs", "methods"));
  const crossCuttingFiles = discoverCrossCuttingSpecs(path.join(root, "specs", "cross-cutting"));

  const workflows = (
    await Promise.all(workflowFiles.map(async (filePath) => parseWorkflowSpec(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(a.id, b.id));

  const methods = (
    await Promise.all(methodFiles.map(async (filePath) => parseMethodSpec(await loadYamlFile(filePath))))
  ).sort((a, b) => stableSort(a.id, b.id));

  const crossCutting = (
    await Promise.all(
      crossCuttingFiles.map(async (filePath) => parseCrossCuttingSpec(await loadYamlFile(filePath))),
    )
  ).sort((a, b) => stableSort(a.id, b.id));

  return {
    workflows,
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
  validateIncludeGraph(specs);

  const completeness = validateCompleteness(specs.methods);
  validateCrossCuttingSpecs(specs.crossCutting);
  const aliasCoverage = validateDispatchAliasCoverage();

  const workflowIndex = buildWorkflowIndex(specs.workflows);
  const resolvedMethods: ResolvedMethodSpec[] = specs.methods.map((method) =>
    mergeResolvedMethodSpec(method, resolveMethodIncludes(method, workflowIndex)),
  );

  const status = getCspiceRunnerStatus();
  if (!status.ready) {
    throw new Error(
      `cspice-runner unavailable: ${status.hint}. Remediation: ensure CSPICE is available and run parity pretest build.`,
    );
  }

  const paritySummary = await withRunners(async (runners) => {
    let crossCuttingCaseCount = 0;
    for (const spec of specs.crossCutting) {
      const summary = await executeCrossCuttingSpec(spec);
      crossCuttingCaseCount += summary.caseCount;
    }

    let methodCaseCount = 0;
    for (const method of resolvedMethods) {
      const summary = await executeMethodSpecParity(method, runners);
      methodCaseCount += summary.caseCount;
    }

    return {
      skipped: false,
      workflowCount: specs.workflows.length,
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
