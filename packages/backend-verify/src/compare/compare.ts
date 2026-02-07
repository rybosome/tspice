import type { CompareOptions, CompareResult, Mismatch } from "./types.js";
import { normalizeForCompare } from "./normalize.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  return base === "$" ? `$.${key}` : `${base}.${key}`;
}

function compareNumbers(
  actual: number,
  expected: number,
  path: string,
  opts: CompareOptions,
): Mismatch | null {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return null;
  if (Object.is(actual, expected)) return null;

  const tolAbs = opts.tolAbs ?? 0;
  const tolRel = opts.tolRel ?? 0;

  const diff = Math.abs(actual - expected);
  const rel = diff / Math.max(1e-30, Math.abs(expected));

  if (diff <= tolAbs) return null;
  if (rel <= tolRel) return null;

  return {
    path,
    actual,
    expected,
    message: `number mismatch: actual=${actual} expected=${expected} (diff=${diff}, rel=${rel})`,
  };
}

function compareInner(
  actualRaw: unknown,
  expectedRaw: unknown,
  path: string,
  opts: CompareOptions,
  mismatches: Mismatch[],
): void {
  const actual = normalizeForCompare(actualRaw);
  const expected = normalizeForCompare(expectedRaw);

  if (typeof actual === "number" && typeof expected === "number") {
    const m = compareNumbers(actual, expected, path, opts);
    if (m) mismatches.push(m);
    return;
  }

  if (
    actual === null ||
    expected === null ||
    actual === undefined ||
    expected === undefined ||
    typeof actual !== "object" ||
    typeof expected !== "object"
  ) {
    if (!Object.is(actual, expected)) {
      mismatches.push({
        path,
        actual,
        expected,
        message: `value mismatch: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`,
      });
    }
    return;
  }

  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      mismatches.push({
        path,
        actual,
        expected,
        message: "type mismatch: one value is array and the other is not",
      });
      return;
    }

    if (actual.length !== expected.length) {
      mismatches.push({
        path,
        actual: actual.length,
        expected: expected.length,
        message: `array length mismatch: actual=${actual.length} expected=${expected.length}`,
      });
    }

    const n = Math.min(actual.length, expected.length);
    for (let i = 0; i < n; i++) {
      compareInner(actual[i], expected[i], joinPath(path, i), opts, mismatches);
    }
    return;
  }

  if (!isRecord(actual) || !isRecord(expected)) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push({
        path,
        actual,
        expected,
        message: "non-plain object mismatch",
      });
    }
    return;
  }

  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  for (const k of expectedKeys) {
    if (!(k in actual)) {
      mismatches.push({
        path: joinPath(path, k),
        actual: undefined,
        expected: expected[k],
        message: "missing key in actual",
      });
    }
  }

  for (const k of actualKeys) {
    if (!(k in expected)) {
      mismatches.push({
        path: joinPath(path, k),
        actual: actual[k],
        expected: undefined,
        message: "unexpected key in actual",
      });
    }
  }

  for (const k of expectedKeys) {
    if (k in actual) {
      compareInner(actual[k], expected[k], joinPath(path, k), opts, mismatches);
    }
  }
}

export function compareValues(actual: unknown, expected: unknown, opts: CompareOptions = {}): CompareResult {
  const mismatches: Mismatch[] = [];
  compareInner(actual, expected, "$", opts, mismatches);
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}
