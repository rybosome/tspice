export type CompareOptions = {
  /** Absolute tolerance (defaults to 0). */
  tolAbs?: number;

  /**
   * Relative tolerance (defaults to 0).
   *
   * Note: no implicit/default `tolRel` is ever applied.
   */
  tolRel?: number;

  /**
   * When true, compare angles using wrapped delta in (-π, π].
   *
   * If neither `tolAbs` nor `tolRel` are provided, a small default `tolAbs` is
   * applied to account for floating-point residuals from wrapping.
   */
  angleWrapPi?: boolean;
};

export type Mismatch = {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type CompareResult =
  | { ok: true }
  | {
      ok: false;
      mismatches: Mismatch[];
    };
