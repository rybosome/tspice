import type { BenchmarkContractV1 } from "../contracts/benchmark-contract/v1/types.js";

export interface RunSuiteOptions {
  /** Optional fixture roots used to resolve suite fixture references. */
  readonly fixtureRoots?: readonly string[];
}

export interface RunnerResult {
  readonly ok: boolean;
}

export interface Runner {
  readonly kind: string;

  runSuite(contract: BenchmarkContractV1, options?: RunSuiteOptions): Promise<RunnerResult>;
}
