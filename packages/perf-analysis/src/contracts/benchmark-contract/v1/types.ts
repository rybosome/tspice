/**
 * v1 benchmark suite contract types.
 *
 * These types are intentionally minimal and may evolve as the contract is implemented.
 */

import type { FixtureRef, FixtureRoots } from "../../../shared/fixtures/types.js";

export type BenchmarkContractVersion = 1;

/**
* YAML-friendly fixture reference input.
*
* Runners should call `normalizeFixtureRefs()` to convert these into canonical
* `FixtureRef` objects.
*/
export type FixtureRefV1 =
  | FixtureRef
  | string
  | {
      readonly id: string;
    }
  | {
      readonly path: string;
    };
export interface BenchmarkCaseV1 {
  /** Stable id for the benchmark case within the suite. */
  readonly id: string;

  /** Optional human-friendly label. */
  readonly name?: string;

  /** Optional kernel fixture reference for this case. */
  readonly kernel?: FixtureRefV1;

  /** Runner-specific configuration payload. */
  readonly config?: Record<string, unknown>;
}

export interface BenchmarkContractV1 {
  /** Schema version. */
  readonly version: 1;

  /** Optional suite name. */
  readonly name?: string;

  /** Optional runner identifier (e.g. "tspice"). */
  readonly runner?: string;

  /**
   * Fixture root directories used to resolve `FixtureRefV1` references.
   *
   * The initial intent is to point this at existing kernel fixtures under:
   * `packages/tspice/test/fixtures/kernels/...`
   */
  readonly fixtureRoots?: FixtureRoots;

  /** Benchmark cases included in the suite. */
  readonly benchmarks: readonly BenchmarkCaseV1[];
}

export interface NormalizeFixtureRefsOptions {
  /**
   * Optional set of fixture roots used to canonicalize fixture references.
   *
   * When omitted, the contract's own `fixtureRoots` may be used.
   */
  readonly fixtureRoots?: FixtureRoots;
}
