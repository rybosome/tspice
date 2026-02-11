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

function normalizeToMinusPiPi(x: number): number {
  if (!Number.isFinite(x)) return x;

  // Normalize into [-pi, pi).
  const y = Math.atan2(Math.sin(x), Math.cos(x));

  // atan2 returns +pi at the branch cut; convert to -pi so we preserve [-pi, pi).
  if (Object.is(y, Math.PI)) return -Math.PI;

  return y;
}

function wrapToPi(x: number): number {
  if (!Number.isFinite(x)) return x;

  const y = normalizeToMinusPiPi(x);

  // Prefer +pi over -pi to keep comparisons deterministic.
  if (Object.is(y, -Math.PI)) return Math.PI;

  return y;
}


function wrapDeltaToPi(raw: number): number {
  if (!Number.isFinite(raw)) return raw;

  const y = normalizeToMinusPiPi(raw);

  // At exactly -pi (the branch cut), preserve the sign of the *raw* delta.
  if (Object.is(y, -Math.PI) && raw > 0) return Math.PI;

  return y;
}

function compareNumbers(
  actual: number,
  expected: number,
  path: string,
  opts: CompareOptions,
): Mismatch | null {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return null;

  const angleWrapPi = opts.angleWrapPi === true;

  const actualNorm = angleWrapPi ? wrapToPi(actual) : actual;
  const expectedNorm = angleWrapPi ? wrapToPi(expected) : expected;

  const tolAbs = opts.tolAbs ?? 0;
  const tolRel = opts.tolRel ?? 0;

  const delta = angleWrapPi ? wrapDeltaToPi(actual - expected) : actual - expected;
  const diff = Math.abs(delta);

  // Fast path: exact equality.
  // `diff === 0` handles +/-0 and angle wrapping.
  if (diff === 0) return null;
  // For infinities, subtraction produces NaN; fall back to exact identity.
  if (Number.isNaN(diff) && Object.is(actualNorm, expectedNorm)) return null;

  // Trig reduction can yield tiny residuals for exact multiples of TAU
  // (e.g. 2π -> ~-2.4e-16). Keep normalization pure; ignore only the
  // reduction noise here, and only when angle wrapping is enabled.
  const ANGLE_WRAP_EPS = 8 * Number.EPSILON;
  if (angleWrapPi && diff < ANGLE_WRAP_EPS) return null;

  // Use a symmetric denominator so tolerance behaves consistently regardless
  // of whether callers treat `actual` or `expected` as the reference.
  const rel = diff / Math.max(1e-30, Math.max(Math.abs(actualNorm), Math.abs(expectedNorm)));

  if (diff <= tolAbs) return null;
  if (rel <= tolRel) return null;

  const message = angleWrapPi
    ? `number mismatch (angleWrapPi): diff=${diff} rel=${rel} tolAbs=${tolAbs} tolRel=${tolRel} (wrappedActual=${actualNorm}, wrappedExpected=${expectedNorm}, delta=${delta})`
    : `number mismatch: diff=${diff} rel=${rel} tolAbs=${tolAbs} tolRel=${tolRel}`;

  return { path, actual, expected, message };
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
