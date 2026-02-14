import type { BenchmarkContract } from "../contracts/index.js";
import type { FixtureRoots } from "../shared/fixtures/types.js";

/** Options passed to a runner when executing a benchmark suite. */
export interface RunSuiteOptions {
  /** Optional fixture roots used to resolve suite fixture references. */
  readonly fixtureRoots?: FixtureRoots;
}

/** Result returned by a runner after executing a suite. */
export interface RunnerResult {
  readonly ok: boolean;
}

/** Runner that can execute a benchmark suite in a specific environment. */
export interface Runner {
  readonly kind: string;

  /** Execute a benchmark contract and return success/failure. */
  runSuite(contract: BenchmarkContract, options?: RunSuiteOptions): Promise<RunnerResult>;
}
