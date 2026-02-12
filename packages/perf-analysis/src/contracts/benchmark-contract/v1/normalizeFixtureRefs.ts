import type { FixtureRef } from "../../../shared/fixtures/types.js";

import type { BenchmarkCaseV1, BenchmarkContractV1, FixtureRefV1, NormalizeFixtureRefsOptions } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFixtureRef(ref: FixtureRefV1): FixtureRef {
  // Shorthand: `kernel: $FIXTURES/...`
  if (typeof ref === "string") {
    return { kind: "path", path: ref };
  }

  // Canonical form.
  if ("kind" in ref) {
    // The validator ensures the inner fields are present.
    return ref as FixtureRef;
  }

  // Shorthand object forms.
  if ("id" in ref) {
    return { kind: "id", id: ref.id };
  }

  return { kind: "path", path: ref.path };
}

function normalizeCase(c: BenchmarkCaseV1): BenchmarkCaseV1 {
  const kernel = c.kernel === undefined ? undefined : normalizeFixtureRef(c.kernel);
  return {
    id: c.id,
    ...(c.name !== undefined ? { name: c.name } : {}),
    ...(kernel !== undefined ? { kernel } : {}),
    ...(c.config !== undefined ? { config: c.config } : {}),
  };
}

/**
 * Normalize fixture references in a v1 benchmark contract (e.g. canonicalize ids/paths).
 */
export function normalizeFixtureRefs(
  contract: BenchmarkContractV1,
  options: NormalizeFixtureRefsOptions = {},
): BenchmarkContractV1 {
  // This module intentionally remains pure (no FS access). Normalization here
  // is structural/canonical only.

  if (!isRecord(contract)) {
    // This should only happen when callers bypass `validate()`.
    throw new TypeError(
      `Expected a v1 benchmark contract object (got ${JSON.stringify(contract)})`,
    );
  }

  const fixtureRoots = options.fixtureRoots ?? contract.fixtureRoots;
  return {
    version: 1,
    benchmarks: contract.benchmarks.map(normalizeCase),
    ...(contract.name !== undefined ? { name: contract.name } : {}),
    ...(contract.runner !== undefined ? { runner: contract.runner } : {}),
    ...(fixtureRoots !== undefined && fixtureRoots.length > 0 ? { fixtureRoots } : {}),
  };
}
