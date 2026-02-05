import type { Mat6RowMajor } from "./types.js";

type FreezeMode = "never" | "dev" | "always";

export type BrandMat6Options = {
  /**
   * Used for error messages (e.g. `"sxform()"`).
   *
   * Defaults to `"Mat6RowMajor"`.
   */
  readonly label?: string;

  /**
   * If set, freeze branded matrices to prevent mutation at runtime.
   *
   * Defaults to `"dev"`.
   */
  readonly freeze?: FreezeMode;
};

const DEFAULT_FREEZE_MODE: FreezeMode = "dev";

// Runtime-only brand (module-private).
const MAT6_ROW_MAJOR_BRAND = Symbol("Mat6RowMajor");

function isDevEnv(): boolean {
  // Safe in non-node runtimes.
  return typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";
}

function shouldFreeze(mode: FreezeMode): boolean {
  switch (mode) {
    case "never":
      return false;
    case "always":
      return true;
    case "dev":
      return isDevEnv();
  }
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

type TypedArrayView =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

function isTypedArrayView(x: unknown): x is TypedArrayView {
  // We intentionally only accept numeric TypedArrays (not BigInt views, not DataView).
  return (
    x instanceof Int8Array ||
    x instanceof Uint8Array ||
    x instanceof Uint8ClampedArray ||
    x instanceof Int16Array ||
    x instanceof Uint16Array ||
    x instanceof Int32Array ||
    x instanceof Uint32Array ||
    x instanceof Float32Array ||
    x instanceof Float64Array
  );
}

function isLength36ArrayLike(x: unknown): x is ArrayLike<unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    (Array.isArray(x) || isTypedArrayView(x)) &&
    typeof (x as ArrayLike<unknown>).length === "number" &&
    (x as ArrayLike<unknown>).length === 36
  );
}

function formatMat6Error(label: string, detail: string): string {
  return `${label}: expected a length-36 array of finite numbers (${detail})`;
}

/** Runtime validation that an input is a length-36 array-like of finite numbers. */
export function assertMat6ArrayLike36(
  value: unknown,
  options?: { readonly label?: string },
): asserts value is ArrayLike<number> {
  const label = options?.label ?? "Mat6";

  if (value instanceof DataView) {
    throw new Error(`${label}: DataView is not a supported Mat6 input (use a TypedArray or number[]).`);
  }

  if (!isLength36ArrayLike(value)) {
    throw new Error(formatMat6Error(label, "wrong shape"));
  }

  for (let i = 0; i < 36; i++) {
    const v = value[i];
    if (!isFiniteNumber(v)) {
      throw new Error(formatMat6Error(label, `index ${i} was ${String(v)}`));
    }
  }
}

/**
* Structural check: accepts number[] and numeric TypedArrays (excludes DataView).
*
* This does **not** assert/require that the value is branded as a row-major Mat6.
*/
export function isMat6ArrayLike36(value: unknown): value is ArrayLike<number> {
  if (value instanceof DataView) return false;
  if (!isLength36ArrayLike(value)) return false;
  for (let i = 0; i < 36; i++) {
    if (!isFiniteNumber(value[i])) return false;
  }
  return true;
}

function tryDefineBrand(target: object, brand: symbol): void {
  try {
    // Non-enumerable to avoid surprising JSON/stringification behavior.
    Object.defineProperty(target, brand, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // Best-effort.
  }
}

function maybeFreeze<T extends object>(value: T, mode: FreezeMode): T {
  if (!shouldFreeze(mode)) return value;
  try {
    return Object.freeze(value);
  } catch {
    return value;
  }
}

/** Validate + brand a value as a row-major 6x6 matrix. */
export function brandMat6RowMajor(value: unknown, options?: BrandMat6Options): Mat6RowMajor {
  const label = options?.label ?? "Mat6RowMajor";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertMat6ArrayLike36(value, { label });

  const arr = Array.from(value);
  tryDefineBrand(arr, MAT6_ROW_MAJOR_BRAND);
  return maybeFreeze(arr, freeze) as unknown as Mat6RowMajor;
}

/**
* Brand-only check: verifies that a value was produced by `brandMat6RowMajor()`.
*/
export function isBrandedMat6RowMajor(value: unknown): value is Mat6RowMajor {
  if (!isLength36ArrayLike(value)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[MAT6_ROW_MAJOR_BRAND]);
}
