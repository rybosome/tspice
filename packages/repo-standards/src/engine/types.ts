import type { RepoStandardsConfig } from "../config/types.js";

/** Source location for a violation (file + 1-based line/column). */
export interface ViolationLocation {
  filePath?: string;
  line?: number;
  col?: number;
  callId?: string;
}

/** Single standards violation produced by a rule. */
export interface Violation {
  ruleId: string;
  packageRoot: string;
  message: string;
  location?: ViolationLocation;
}

/** Report produced by running repo-standards across a repo. */
export interface RepoStandardsReport {
  repoRoot: string;
  configPath: string;
  violations: Violation[];
}

/** Options for running the repo-standards rule set. */
export interface RunStandardsOptions {
  repoRoot: string;
  configPath: string;
  config: RepoStandardsConfig;
  onlyRuleId?: string;
  onlyPackageRoot?: string;
}
