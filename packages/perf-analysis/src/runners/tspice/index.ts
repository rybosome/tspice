import type { Runner } from "../types.js";

export interface CreateTspiceRunnerOptions {
  readonly tspiceCommand?: string;
}

/**
 * Create a placeholder runner implementation for tspice.
 *
 * NOTE: runner orchestration is intentionally unimplemented in this scaffold.
 */
export function createTspiceRunner(_options: CreateTspiceRunnerOptions = {}): Runner {
  throw new Error("not implemented");
}
