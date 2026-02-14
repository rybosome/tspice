import type { RepoStandardsReport, RunStandardsOptions, Violation } from "./types.js";
import { buildRepoContext } from "../indexing/buildRepoContext.js";
import { knownRuleIds, ruleRegistry } from "../rules/registry.js";

/**
 * Runs all enabled standards and returns a consolidated report.
 */
export async function runStandards(opts: RunStandardsOptions): Promise<RepoStandardsReport> {
  const violations: Violation[] = [];

  const packageRootsByRuleId = new Map<string, string[]>();

  for (const ruleId of knownRuleIds) {
    if (opts.onlyRuleId && ruleId !== opts.onlyRuleId) continue;

    const ruleCfg = opts.config.rules[ruleId];
    if (!ruleCfg) continue;

    const selectedPackages = ruleCfg.packages.filter(
      (pkgRoot) => !opts.onlyPackageRoot || pkgRoot === opts.onlyPackageRoot
    );

    if (selectedPackages.length === 0) continue;

    packageRootsByRuleId.set(ruleId, selectedPackages);
  }

  const packageRoots = Array.from(
    new Set(Array.from(packageRootsByRuleId.values()).flat())
  ).sort();

  if (packageRoots.length > 0) {
    const ctx = await buildRepoContext({
      repoRoot: opts.repoRoot,
      packageRoots
    });

    for (const ruleId of knownRuleIds) {
      const selectedPackages = packageRootsByRuleId.get(ruleId);
      if (!selectedPackages) continue;

      const rule = ruleRegistry[ruleId];

      for (const packageRoot of selectedPackages) {
        violations.push(
          ...(await rule.run({
            ctx,
            packageRoot
          }))
        );
      }
    }
  }

  return {
    repoRoot: opts.repoRoot,
    configPath: opts.configPath,
    violations
  };
}
