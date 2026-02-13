import type { Violation } from "../engine/types.js";
import type { RepoContext } from "../indexing/buildRepoContext.js";

export interface RuleRunInput {
  ctx: RepoContext;
  packageRoot: string;
}

export type RuleRunResult = Violation[] | Promise<Violation[]>;

export type RuleRun = (input: RuleRunInput) => RuleRunResult;

export interface RepoStandardsRule {
  description: string;
  run: RuleRun;
}
