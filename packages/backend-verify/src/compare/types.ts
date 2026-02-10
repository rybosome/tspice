export type CompareOptions = {
  tolAbs?: number;
  tolRel?: number;
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
