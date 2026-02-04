import type { Mat3ColMajor, Mat3RowMajor } from "./types.js";
import { __mat3ColMajorBrand, __mat3RowMajorBrand } from "./types.js";

type FreezeMode = "never" | "dev" | "always";

export type BrandMat3Options = {
  /**
   * Used for error messages (e.g. `"pxform()"`).
   *
   * Defaults to `"Mat3"`.
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

function formatMat3Error(label: string, detail: string): string {
  return `${label}: expected a length-9 array of finite numbers (${detail})`;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isLength9ArrayLike(x: unknown): x is ArrayLike<unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    // arrays + typed arrays
    (Array.isArray(x) || ArrayBuffer.isView(x)) &&
    typeof (x as ArrayLike<unknown>).length === "number" &&
    (x as ArrayLike<unknown>).length === 9
  );
}

/**
* Runtime validation that an input is a length-9 array-like of finite numbers.
*
* This is intentionally layout-agnostic; it is used by both row-major and
* column-major branded types.
*/
export function assertMat3ArrayLike9(value: unknown, options?: { readonly label?: string }): asserts value is ArrayLike<number> {
  const label = options?.label ?? "Mat3";
  if (!isLength9ArrayLike(value)) {
    throw new Error(formatMat3Error(label, "wrong shape"));
  }

  for (let i = 0; i < 9; i++) {
    const v = value[i];
    if (!isFiniteNumber(v)) {
      throw new Error(formatMat3Error(label, `index ${i} was ${String(v)}`));
    }
  }
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
    // Best-effort: some exotic objects may be non-extensible.
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

/**
* Validate + brand a value as a row-major Mat3.
*
* Used at backend boundaries (node/wasm/fake) to avoid ad-hoc `as Mat3RowMajor`
* casts.
*/
export function brandMat3RowMajor(value: unknown, options?: BrandMat3Options): Mat3RowMajor {
  const label = options?.label ?? "Mat3RowMajor";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertMat3ArrayLike9(value, { label });

  const arr = Array.isArray(value) ? value : Array.from(value as ArrayLike<number>);
  tryDefineBrand(arr, __mat3RowMajorBrand);
  return maybeFreeze(arr, freeze) as unknown as Mat3RowMajor;
}

/**
* Validate + brand a value as a column-major Mat3.
*/
export function brandMat3ColMajor(value: unknown, options?: BrandMat3Options): Mat3ColMajor {
  const label = options?.label ?? "Mat3ColMajor";
  const freeze = options?.freeze ?? DEFAULT_FREEZE_MODE;

  assertMat3ArrayLike9(value, { label });

  const arr = Array.isArray(value) ? value : Array.from(value as ArrayLike<number>);
  tryDefineBrand(arr, __mat3ColMajorBrand);
  return maybeFreeze(arr, freeze) as unknown as Mat3ColMajor;
}

export function isMat3RowMajor(value: unknown): value is Mat3RowMajor {
  if (!isLength9ArrayLike(value)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[__mat3RowMajorBrand]);
}

export function isMat3ColMajor(value: unknown): value is Mat3ColMajor {
  if (!isLength9ArrayLike(value)) return false;
  return Boolean((value as unknown as Record<symbol, unknown>)[__mat3ColMajorBrand]);
}
