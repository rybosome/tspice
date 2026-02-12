import type { RepoStandardsReport, RunStandardsOptions, Violation } from "./types.js";

export async function runStandards(opts: RunStandardsOptions): Promise<RepoStandardsReport> {
  const violations: Violation[] = [];

  // Skeleton engine: no actual repo indexing yet.
  // We still walk config to validate filters and keep semantics stable.
  for (const [ruleId, ruleCfg] of Object.entries(opts.config.rules)) {
    if (opts.onlyRuleId && ruleId !== opts.onlyRuleId) continue;

    for (const pkg of ruleCfg.packages) {
      if (opts.onlyPackageRoot && pkg !== opts.onlyPackageRoot) continue;
      // Rule implementations land in later breakdowns.
      void pkg;
    }
  }

  return {
    repoRoot: opts.repoRoot,
    configPath: opts.configPath,
    violations
  };
}
