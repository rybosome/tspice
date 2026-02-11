import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FIXTURE_ROOTS_V1, resolveFixtureRef } from "./fixtures.js";
import { formatPath, type PathSegment } from "./paths.js";
import type {
  BenchmarkSuiteV1,
  BenchmarkV1,
  FixtureRootsV1,
  ValidateBenchmarkSuiteV1Options,
  ValidationError,
  ValidationResult,
} from "./types.js";
import { hasOwn, isNonEmptyString, isRecord } from "./utils.js";

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function shouldCheckFixtureExistence(
  options: ValidateBenchmarkSuiteV1Options,
): boolean {
  return options.checkFixtureExistence !== false;
}

function fixtureRootsCacheKey(roots: FixtureRootsV1): string {
  return JSON.stringify(
    Object.entries(roots).sort(([a], [b]) => a.localeCompare(b)),
  );
}

interface FixtureResolutionContext {
  readonly repoRoot: string;
  readonly checkExistence: boolean;
  readonly effectiveFixtureRoots: FixtureRootsV1;
  readonly cacheKeyPrefix: string;
  readonly fixtureRefCache: Map<string, ReturnType<typeof resolveFixtureRef>>;
}

function pushError(
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  message: string,
): void {
  errors.push({ path: formatPath(pathSegments), message });
}

function asRecord(
  value: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
): Record<string, unknown> | null {
  if (isRecord(value)) return value;

  pushError(errors, pathSegments, "Expected an object.");
  return null;
}

function validateFixtureRoots(
  fixtureRoots: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  options: ValidateBenchmarkSuiteV1Options,
): FixtureRootsV1 | undefined {
  if (fixtureRoots === undefined) return undefined;

  const record = asRecord(fixtureRoots, errors, pathSegments);
  if (record === null) return undefined;

  const cleaned: Record<string, string> = {};

  for (const [rootName, rootPath] of Object.entries(record)) {
    const trimmedName = rootName.trim();

    if (trimmedName.length === 0) {
      pushError(
        errors,
        [...pathSegments, rootName],
        "Fixture root names must be non-empty strings.",
      );
      continue;
    }

    if (typeof rootPath !== "string") {
      pushError(
        errors,
        [...pathSegments, rootName],
        "Fixture root paths must be strings.",
      );
      continue;
    }

    const trimmedPath = rootPath.trim();

    if (trimmedPath.length === 0) {
      pushError(
        errors,
        [...pathSegments, rootName],
        "Fixture root paths must be non-empty strings.",
      );
      continue;
    }

    if (path.posix.isAbsolute(trimmedPath) || path.win32.isAbsolute(trimmedPath)) {
      pushError(
        errors,
        [...pathSegments, rootName],
        "Fixture root paths must be relative (absolute paths are not allowed).",
      );
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(cleaned, trimmedName)) {
      pushError(
        errors,
        [...pathSegments, rootName],
        `Duplicate fixture root name '${trimmedName}'. Fixture root names must be unique.`,
      );
      continue;
    }

    cleaned[trimmedName] = trimmedPath;

    if (shouldCheckFixtureExistence(options)) {
      const absoluteRoot = path.resolve(options.repoRoot, trimmedPath);
      try {
        const stat = fs.statSync(absoluteRoot);
        if (!stat.isDirectory()) {
          pushError(
            errors,
            [...pathSegments, rootName],
            `Fixture root is not a directory: ${absoluteRoot}`,
          );
        }
      } catch {
        pushError(
          errors,
          [...pathSegments, rootName],
          `Fixture root directory not found: ${absoluteRoot}`,
        );
      }
    }
  }

  return cleaned as FixtureRootsV1;
}

function validateKernels(
  kernels: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  fixtureCtx: FixtureResolutionContext,
): void {
  if (kernels === undefined) return;

  if (!Array.isArray(kernels)) {
    pushError(errors, pathSegments, "Expected an array of fixture refs.");
    return;
  }

  for (let i = 0; i < kernels.length; i += 1) {
    const kernelRef = kernels[i];
    const itemPath = [...pathSegments, i];

    if (!isNonEmptyString(kernelRef)) {
      pushError(errors, itemPath, "Kernel fixture ref must be a non-empty string.");
      continue;
    }

    const cacheKey = `${fixtureCtx.cacheKeyPrefix}${kernelRef}`;

    let resolved = fixtureCtx.fixtureRefCache.get(cacheKey);
    if (resolved === undefined) {
      resolved = resolveFixtureRef(kernelRef, {
        repoRoot: fixtureCtx.repoRoot,
        defaultFixtureRoots: fixtureCtx.effectiveFixtureRoots,
        checkExistence: fixtureCtx.checkExistence,
      });
      fixtureCtx.fixtureRefCache.set(cacheKey, resolved);
    }

    if (!resolved.ok) {
      pushError(errors, itemPath, resolved.message);
    }
  }
}

function validateSetup(
  setup: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  fixtureCtx: FixtureResolutionContext,
): void {
  if (setup === undefined) return;

  const record = asRecord(setup, errors, pathSegments);
  if (record === null) return;

  if (hasOwn(record, "kernels")) {
    validateKernels(
      record.kernels,
      errors,
      [...pathSegments, "kernels"],
      fixtureCtx,
    );
  }
}

function validateVarRefs(
  value: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  knownVars: ReadonlySet<string>,
  visited: WeakSet<object> = new WeakSet(),
): void {
  if (value === undefined) return;

  if (typeof value === "object" && value !== null) {
    if (visited.has(value)) return;
    visited.add(value);
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      validateVarRefs(value[i], errors, [...pathSegments, i], knownVars, visited);
    }
    return;
  }

  if (!isRecord(value)) return;

  if (hasOwn(value, "$ref")) {
    if (Object.keys(value).length !== 1) {
      pushError(
        errors,
        pathSegments,
        "Reference objects may only contain the '$ref' field.",
      );
    }

    const refValue = value.$ref;

    if (typeof refValue !== "string") {
      pushError(errors, [...pathSegments, "$ref"], "$ref must be a string.");
      return;
    }

    if (!refValue.startsWith("var.")) {
      pushError(
        errors,
        [...pathSegments, "$ref"],
        `Unsupported $ref '${refValue}'. Expected 'var.<name>'.`,
      );
      return;
    }

    const name = refValue.slice("var.".length);
    if (!IDENTIFIER_RE.test(name)) {
      pushError(
        errors,
        [...pathSegments, "$ref"],
        `Invalid variable ref '${refValue}'. Expected 'var.<identifier>'.`,
      );
      return;
    }

    if (!knownVars.has(name)) {
      pushError(
        errors,
        [...pathSegments, "$ref"],
        `Unknown workflow var '${name}'. Add 'saveAs: ${name}' on a prior step.`,
      );
    }

    return;
  }

  for (const [key, child] of Object.entries(value)) {
    validateVarRefs(child, errors, [...pathSegments, key], knownVars, visited);
  }
}

function validateMicroBenchmark(
  benchmark: Record<string, unknown>,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
): void {
  if (hasOwn(benchmark, "steps")) {
    pushError(
      errors,
      [...pathSegments, "steps"],
      "Workflow-only field 'steps' is not allowed when kind is 'micro'.",
    );
  }

  if (!hasOwn(benchmark, "cases")) {
    pushError(
      errors,
      pathSegments,
      "Micro benchmark is missing required field 'cases'.",
    );
    return;
  }

  const cases = benchmark.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    pushError(errors, [...pathSegments, "cases"], "Expected a non-empty array.");
    return;
  }

  for (let i = 0; i < cases.length; i += 1) {
    const caseValue = cases[i];
    const casePath = [...pathSegments, "cases", i];

    const caseRecord = asRecord(caseValue, errors, casePath);
    if (caseRecord === null) continue;

    if (!hasOwn(caseRecord, "call") || !isNonEmptyString(caseRecord.call)) {
      pushError(
        errors,
        [...casePath, "call"],
        "Case field 'call' must be a non-empty string.",
      );
    }
  }
}

function validateWorkflowBenchmark(
  benchmark: Record<string, unknown>,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
): void {
  if (hasOwn(benchmark, "cases")) {
    pushError(
      errors,
      [...pathSegments, "cases"],
      "Micro-only field 'cases' is not allowed when kind is 'workflow'.",
    );
  }

  if (!hasOwn(benchmark, "steps")) {
    pushError(
      errors,
      pathSegments,
      "Workflow benchmark is missing required field 'steps'.",
    );
    return;
  }

  const steps = benchmark.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    pushError(errors, [...pathSegments, "steps"], "Expected a non-empty array.");
    return;
  }

  const knownVars = new Set<string>();

  for (let i = 0; i < steps.length; i += 1) {
    const stepValue = steps[i];
    const stepPath = [...pathSegments, "steps", i];

    const stepRecord = asRecord(stepValue, errors, stepPath);
    if (stepRecord === null) continue;

    if (!hasOwn(stepRecord, "call") || !isNonEmptyString(stepRecord.call)) {
      pushError(
        errors,
        [...stepPath, "call"],
        "Step field 'call' must be a non-empty string.",
      );
    }

    if (hasOwn(stepRecord, "args")) {
      validateVarRefs(stepRecord.args, errors, [...stepPath, "args"], knownVars);
    }

    if (hasOwn(stepRecord, "saveAs")) {
      const saveAs = stepRecord.saveAs;

      if (!isNonEmptyString(saveAs) || !IDENTIFIER_RE.test(saveAs)) {
        pushError(
          errors,
          [...stepPath, "saveAs"],
          "saveAs must be a non-empty identifier string (e.g. 'result').",
        );
      } else if (knownVars.has(saveAs)) {
        pushError(
          errors,
          [...stepPath, "saveAs"],
          `Duplicate saveAs name '${saveAs}'. Choose a unique variable name.`,
        );
      } else {
        knownVars.add(saveAs);
      }
    }

    if (hasOwn(stepRecord, "sink")) {
      const sink = stepRecord.sink;

      const isValidSink =
        typeof sink === "boolean" || (typeof sink === "string" && sink.length > 0);

      if (!isValidSink) {
        pushError(
          errors,
          [...stepPath, "sink"],
          "sink must be a non-empty string or boolean.",
        );
      }
    }
  }
}

function validateBenchmark(
  value: unknown,
  errors: ValidationError[],
  pathSegments: readonly PathSegment[],
  fixtureCtx: FixtureResolutionContext,
): BenchmarkV1 | null {
  const record = asRecord(value, errors, pathSegments);
  if (record === null) return null;

  if (!hasOwn(record, "id") || !isNonEmptyString(record.id)) {
    pushError(errors, [...pathSegments, "id"], "Benchmark 'id' is required.");
  }

  if (!hasOwn(record, "kind") || typeof record.kind !== "string") {
    pushError(
      errors,
      [...pathSegments, "kind"],
      "Benchmark 'kind' must be 'micro' or 'workflow'.",
    );
    return null;
  }

  const kind = record.kind;
  if (kind !== "micro" && kind !== "workflow") {
    pushError(
      errors,
      [...pathSegments, "kind"],
      "Benchmark 'kind' must be 'micro' or 'workflow'.",
    );
    return null;
  }

  if (hasOwn(record, "setup")) {
    validateSetup(
      record.setup,
      errors,
      [...pathSegments, "setup"],
      fixtureCtx,
    );
  }

  if (kind === "micro") {
    validateMicroBenchmark(record, errors, pathSegments);
  } else {
    validateWorkflowBenchmark(record, errors, pathSegments);
  }

  return record as unknown as BenchmarkV1;
}

export function validateBenchmarkSuiteV1(
  value: unknown,
  options: ValidateBenchmarkSuiteV1Options,
): ValidationResult<BenchmarkSuiteV1> {
  const errors: ValidationError[] = [];
  const fixtureRefCache = new Map<string, ReturnType<typeof resolveFixtureRef>>();

  const record = asRecord(value, errors, []);
  if (record === null) return { ok: false, errors };

  if (!hasOwn(record, "schemaVersion") || record.schemaVersion !== 1) {
    pushError(
      errors,
      ["schemaVersion"],
      "schemaVersion must be the number 1 for v1.",
    );
  }

  if (hasOwn(record, "suite") && record.suite !== undefined) {
    if (typeof record.suite !== "string") {
      pushError(errors, ["suite"], "suite must be a string.");
    }
  }

  const fixtureRoots = validateFixtureRoots(
    record.fixtureRoots,
    errors,
    ["fixtureRoots"],
    options,
  );

  const checkExistence = shouldCheckFixtureExistence(options);
  const effectiveFixtureRoots: FixtureRootsV1 = {
    ...(options.defaultFixtureRoots ?? DEFAULT_FIXTURE_ROOTS_V1),
    ...(fixtureRoots ?? {}),
  };
  const effectiveFixtureRootsKey = fixtureRootsCacheKey(effectiveFixtureRoots);

  const fixtureCtx: FixtureResolutionContext = {
    repoRoot: options.repoRoot,
    checkExistence,
    effectiveFixtureRoots,
    cacheKeyPrefix: `${checkExistence ? 1 : 0}:${effectiveFixtureRootsKey}:`,
    fixtureRefCache,
  };

  if (hasOwn(record, "defaults")) {
    const defaultsRecord = asRecord(record.defaults, errors, ["defaults"]);

    if (defaultsRecord !== null && hasOwn(defaultsRecord, "setup")) {
      validateSetup(
        defaultsRecord.setup,
        errors,
        ["defaults", "setup"],
        fixtureCtx,
      );
    }
  }

  if (!hasOwn(record, "benchmarks")) {
    pushError(errors, ["benchmarks"], "benchmarks is required.");
  } else if (!Array.isArray(record.benchmarks)) {
    pushError(errors, ["benchmarks"], "benchmarks must be an array.");
  } else {
    const seenIds = new Set<string>();

    for (let i = 0; i < record.benchmarks.length; i += 1) {
      const benchmarkPath = ["benchmarks", i] satisfies PathSegment[];

      const benchmarkValue = record.benchmarks[i];
      const benchmarkRecord = isRecord(benchmarkValue) ? benchmarkValue : null;
      const benchmarkId =
        benchmarkRecord !== null && typeof benchmarkRecord.id === "string"
          ? benchmarkRecord.id
          : null;

      validateBenchmark(
        benchmarkValue,
        errors,
        benchmarkPath,
        fixtureCtx,
      );

      // Keep duplicate-id detection at the suite level, even when a benchmark is
      // otherwise structurally invalid.
      if (benchmarkId !== null) {
        const id = benchmarkId;
        if (seenIds.has(id)) {
          pushError(
            errors,
            [...benchmarkPath, "id"],
            `Duplicate benchmark id '${id}'. Benchmark ids must be unique.`,
          );
        }
        seenIds.add(id);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: record as unknown as BenchmarkSuiteV1 };
}
