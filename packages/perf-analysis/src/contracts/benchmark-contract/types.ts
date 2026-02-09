import type { BenchmarkContractV1 } from "./v1/types.js";

/**
 * Stable contract surface used by runners and tooling.
 *
 * Today this is just v1, but this indirection prevents runner APIs from
 * hard-coding a specific version.
 */
export type BenchmarkContract = BenchmarkContractV1;
