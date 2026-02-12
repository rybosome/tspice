/**
* Root directories searched for fixtures.
*
* These will likely default to existing tspice test fixtures during early development.
*/
export type FixtureRoots = readonly string[];

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

  /**
   * When set, any nested references (e.g. meta-kernel expansions) must resolve
   * within this directory.
   *
   * This is primarily used for fixture-pack directory aliases.
   */
  readonly restrictToDir?: string;
}
