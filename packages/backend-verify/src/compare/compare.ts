import type { CompareOptions, CompareResult, Mismatch } from "./types.js";
import { normalizeForCompare } from "./normalize.js";
import { safeStringify } from "./safeStringify.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function joinPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  return base === "$" ? `$.${key}` : `${base}.${key}`;
}

const TAU = 2 * Math.PI;

function wrapToPi(x: number): number {
  if (!Number.isFinite(x)) return x;

  // Normalize into [-pi, pi).
  const y = ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

  // Prefer +pi over -pi to keep comparisons deterministic.
  if (Object.is(y, -Math.PI)) return Math.PI;

  return y;
}

function compareNumbers(
  actual: number,
  expected: number,
  path: string,
  opts: CompareOptions,
): Mismatch | null {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return null;

  const actualNorm = opts.angleWrapPi ? wrapToPi(actual) : actual;
  const expectedNorm = opts.angleWrapPi ? wrapToPi(expected) : expected;

  if (Object.is(actualNorm, expectedNorm)) return null;

  const tolAbs = opts.tolAbs ?? 0;
  const tolRel = opts.tolRel ?? 0;

  const diff = Math.abs(actualNorm - expectedNorm);
  // Use a symmetric denominator so tolerance behaves consistently regardless
  // of whether callers treat `actual` or `expected` as the reference.
  const rel = diff / Math.max(1e-30, Math.max(Math.abs(actualNorm), Math.abs(expectedNorm)));

  if (diff <= tolAbs) return null;
  if (rel <= tolRel) return null;

  return {
    path,
    actual: actualNorm,
    expected: expectedNorm,
    message: `number mismatch: actual=${actualNorm} expected=${expectedNorm} (diff=${diff}, rel=${rel})`,
  };
}

function compareInner(
  actual: unknown,
  expected: unknown,
  path: string,
  opts: CompareOptions,
  mismatches: Mismatch[],
): void {
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
        message: `value mismatch: actual=${safeStringify(actual)} expected=${safeStringify(expected)}`,
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

  if (!isPlainObject(actual) || !isPlainObject(expected)) {
    const actualTag = Object.prototype.toString.call(actual);
    const expectedTag = Object.prototype.toString.call(expected);

    mismatches.push({
      path,
      actual,
      expected,
      message: `non-plain object mismatch (post-normalization): actualType=${actualTag} expectedType=${expectedTag}`,
    });
    return;
  }

  // Sorting here keeps mismatch ordering stable even if a caller bypasses
  // normalization (or if future normalization changes its insertion ordering).
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

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
  const actualNorm = normalizeForCompare(actual);
  const expectedNorm = normalizeForCompare(expected);
  compareInner(actualNorm, expectedNorm, "$", opts, mismatches);
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}
