import type { FixtureRef } from "../../../shared/fixtures/types.js";

import type {
  BenchmarkCaseV1,
  BenchmarkContractV1,
  FixtureRefV1,
  NormalizedBenchmarkCaseV1,
  NormalizedBenchmarkContractV1,
  NormalizeFixtureRefsOptions,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFixtureRef(ref: FixtureRefV1): FixtureRef {
  // Shorthand: `kernel: $FIXTURES/...`
  if (typeof ref === "string") {
    return { kind: "path", path: ref };
  }

  if (!isRecord(ref)) {
    throw new TypeError(
      `Fixture ref must be a string or mapping/object (got ${JSON.stringify(ref)})`,
    );
  }

  // Canonical form.
  if ("kind" in ref) {
    const kind = ref.kind;
    if (kind === "id") {
      if (typeof ref.id !== "string") {
        throw new TypeError(
          `Fixture ref kind="id" requires an id string (got ${JSON.stringify(ref.id)})`,
        );
      }
      return { kind: "id", id: ref.id };
    }

    if (kind === "path") {
      if (typeof ref.path !== "string") {
        throw new TypeError(
          `Fixture ref kind="path" requires a path string (got ${JSON.stringify(ref.path)})`,
        );
      }
      return { kind: "path", path: ref.path };
    }

    throw new TypeError(
      `Fixture ref kind must be "id" or "path" (got ${JSON.stringify(kind)})`,
    );
  }

  // Shorthand object forms.
  if ("id" in ref) {
    if (typeof ref.id !== "string") {
      throw new TypeError(`Fixture ref id must be a string (got ${JSON.stringify(ref.id)})`);
    }
    return { kind: "id", id: ref.id };
  }

  if ("path" in ref) {
    if (typeof ref.path !== "string") {
      throw new TypeError(
        `Fixture ref path must be a string (got ${JSON.stringify(ref.path)})`,
      );
    }
    return { kind: "path", path: ref.path };
  }

  throw new TypeError(
    `Fixture ref must include either {kind, ...}, {id}, or {path} (got ${JSON.stringify(ref)})`,
  );
}

function normalizeCase(c: BenchmarkCaseV1): NormalizedBenchmarkCaseV1 {
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
): NormalizedBenchmarkContractV1 {
  // This module intentionally remains pure (no FS access). Normalization here
  // is structural/canonical only.

  if (!isRecord(contract)) {
    // This should only happen when callers bypass `validate()`.
    throw new TypeError(
      `Expected a v1 benchmark contract object (got ${JSON.stringify(contract)})`,
    );
  }

  const allowedKeys = new Set(["version", "name", "runner", "fixtureRoots", "benchmarks"]);
  const unknownKeys = Object.keys(contract).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `Benchmark contract contains unknown top-level keys: ${unknownKeys.map((k) => JSON.stringify(k)).join(", ")}. ` +
        `Allowed keys: ${[...allowedKeys].map((k) => JSON.stringify(k)).join(", ")}.`,
    );
  }

  if (contract.version !== 1) {
    throw new TypeError(`Expected v1 benchmark contract version=1 (got ${JSON.stringify(contract.version)})`);
  }

  if (!Array.isArray(contract.benchmarks)) {
    throw new TypeError(`benchmarks must be an array (got ${JSON.stringify(contract.benchmarks)})`);
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
