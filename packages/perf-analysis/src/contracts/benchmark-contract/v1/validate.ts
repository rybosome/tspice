import type { BenchmarkCaseV1, BenchmarkContractV1, FixtureRefV1 } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  if (typeof value === "string") return value;
  throw new TypeError(`${label} must be a string (got ${JSON.stringify(value)})`);
}

function assertVersion(value: unknown): 1 {
  if (value === 1) return 1;
  throw new TypeError(`version must be 1 (got ${JSON.stringify(value)})`);
}

function asStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of strings (got ${JSON.stringify(value)})`);
  }
  return value.map((v, i) => assertString(v, `${label}[${i}]`));
}

function validateFixtureRef(value: unknown, label: string): FixtureRefV1 | undefined {
  if (value === undefined) return undefined;

  // YAML-friendly shorthand: `kernel: $FIXTURES/...`
  if (typeof value === "string") return value;

  if (!isRecord(value)) {
    throw new TypeError(`${label} must be a string or mapping/object (got ${JSON.stringify(value)})`);
  }

  // Canonical form: { kind: "id" | "path", ... }
  if ("kind" in value) {
    const kind = value.kind;
    if (kind === "id") {
      return { kind: "id", id: assertString(value.id, `${label}.id`) };
    }
    if (kind === "path") {
      return { kind: "path", path: assertString(value.path, `${label}.path`) };
    }
    throw new TypeError(`${label}.kind must be "id" or "path" (got ${JSON.stringify(kind)})`);
  }

  // Shorthand object forms: { id: "..." } or { path: "..." }
  if ("id" in value) {
    return { id: assertString(value.id, `${label}.id`) };
  }
  if ("path" in value) {
    return { path: assertString(value.path, `${label}.path`) };
  }

  throw new TypeError(
    `${label} must include either {kind, ...}, {id}, or {path} (got ${JSON.stringify(value)})`,
  );
}

function validateBenchmarkCase(value: unknown, index: number): BenchmarkCaseV1 {
  const label = `benchmarks[${index}]`;
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be a mapping/object (got ${JSON.stringify(value)})`);
  }

  if (value.id === null) {
    // Treat `null` as explicit invalid input; only `undefined` counts as missing.
    throw new TypeError(`${label}.id must be a string (got null)`);
  }

  const id = assertString(value.id, `${label}.id`);
  const name = value.name === undefined ? undefined : assertString(value.name, `${label}.name`);
  const kernel = validateFixtureRef(value.kernel, `${label}.kernel`);

  const configRaw = value.config;
  if (configRaw !== undefined && !isRecord(configRaw)) {
    throw new TypeError(`${label}.config must be a mapping/object (got ${JSON.stringify(configRaw)})`);
  }

  return {
    id,
    ...(name !== undefined ? { name } : {}),
    ...(kernel !== undefined ? { kernel } : {}),
    ...(configRaw !== undefined ? { config: configRaw } : {}),
  };
}

/**
 * Validate an unknown value as a v1 benchmark contract.
 */
export function validate(value: unknown): BenchmarkContractV1 {
  if (!isRecord(value)) {
    throw new TypeError(
      `Benchmark suite YAML must be a mapping/object at the top level (got ${JSON.stringify(value)})`,
    );
  }

  const allowedKeys = new Set(["version", "name", "runner", "fixtureRoots", "benchmarks"]);
  const unknownKeys = Object.keys(value).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `Benchmark suite YAML contains unknown top-level keys: ${unknownKeys.map((k) => JSON.stringify(k)).join(", ")}. ` +
        `Allowed keys: ${[...allowedKeys].map((k) => JSON.stringify(k)).join(", ")}.`,
    );
  }

  const version = assertVersion(value.version);
  const name = value.name === undefined ? undefined : assertString(value.name, "name");
  const runner = value.runner === undefined ? undefined : assertString(value.runner, "runner");

  // Optional fixture roots.
  const fixtureRootsRaw = value.fixtureRoots;
  const fixtureRoots = fixtureRootsRaw === undefined ? undefined : asStringArray(fixtureRootsRaw, "fixtureRoots");

  if (!Array.isArray(value.benchmarks)) {
    throw new TypeError(`benchmarks must be an array (got ${JSON.stringify(value.benchmarks)})`);
  }

  const benchmarks = value.benchmarks.map((c, i) => validateBenchmarkCase(c, i));

  return {
    version,
    benchmarks,
    ...(name !== undefined ? { name } : {}),
    ...(runner !== undefined ? { runner } : {}),
    ...(fixtureRoots !== undefined && fixtureRoots.length > 0 ? { fixtureRoots } : {}),
  };
}
