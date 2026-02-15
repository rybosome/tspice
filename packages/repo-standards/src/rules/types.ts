import type { Violation } from "../engine/types.js";
import type { RepoContext } from "../indexing/buildRepoContext.js";

/** Input passed to a rule's `run()` implementation. */
export interface RuleRunInput {
  ctx: RepoContext;
  packageRoot: string;
}

export type RuleRunResult = Violation[] | Promise<Violation[]>;

export type RuleRun = (input: RuleRunInput) => RuleRunResult;

/** Single repo-standards rule definition (description + runnable implementation). */
export interface RepoStandardsRule {
  description: string;
  run: RuleRun;
}
