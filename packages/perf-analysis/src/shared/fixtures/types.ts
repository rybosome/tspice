export interface FixtureRoots {
  /**
   * Root directories searched for fixtures.
   *
   * These will likely default to existing tspice test fixtures during early development.
   */
  readonly roots: readonly string[];
}

export type FixtureRef =
  | {
      readonly kind: "id";
      readonly id: string;
    }
  | {
      readonly kind: "path";
      readonly path: string;
    };

export interface ResolvedFixtureRef {
  /** Canonical fixture id (when available). */
  readonly id?: string;

  /** Canonical path string (absolute/normalized as appropriate for the runner). */
  readonly path: string;
}
