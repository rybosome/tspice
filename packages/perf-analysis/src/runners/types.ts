import type { BenchmarkContract } from "../contracts/index.js";
import type { FixtureRoots } from "../shared/fixtures/types.js";

export interface RunSuiteOptions {
  /** Optional fixture roots used to resolve suite fixture references. */
  readonly fixtureRoots?: FixtureRoots;
}

export interface RunnerResult {
  readonly ok: boolean;
}

export interface Runner {
  readonly kind: string;

  runSuite(contract: BenchmarkContract, options?: RunSuiteOptions): Promise<RunnerResult>;
}
