import type { RepoStandardsReport, RunStandardsOptions, Violation } from "./types.js";
import { buildRepoContext } from "../indexing/buildRepoContext.js";
import { knownRuleIds, ruleRegistry } from "../rules/registry.js";

export async function runStandards(opts: RunStandardsOptions): Promise<RepoStandardsReport> {
  const violations: Violation[] = [];

  const selectedPackageRoots = new Set<string>();

  for (const ruleId of knownRuleIds) {
    if (opts.onlyRuleId && ruleId !== opts.onlyRuleId) continue;

    const ruleCfg = opts.config.rules[ruleId];
    if (!ruleCfg) continue;

    for (const pkg of ruleCfg.packages) {
      if (opts.onlyPackageRoot && pkg !== opts.onlyPackageRoot) continue;
      selectedPackageRoots.add(pkg);
    }
  }

  const packageRoots = [...selectedPackageRoots].sort();

  if (packageRoots.length > 0) {
    const ctx = await buildRepoContext({
      repoRoot: opts.repoRoot,
      packageRoots
    });

    const enabledPackagesByRuleId = new Map<string, Set<string>>(
      knownRuleIds.map((ruleId) => [ruleId, new Set(opts.config.rules[ruleId]?.packages ?? [])])
    );

    for (const pkg of ctx.index.packages) {
      if (opts.onlyPackageRoot && pkg.packageRoot !== opts.onlyPackageRoot) continue;

      for (const ruleId of knownRuleIds) {
        if (opts.onlyRuleId && ruleId !== opts.onlyRuleId) continue;
        if (!(enabledPackagesByRuleId.get(ruleId)?.has(pkg.packageRoot) ?? false)) continue;

        const rule = ruleRegistry[ruleId];
        violations.push(
          ...(await rule.run({
            ctx,
            packageRoot: pkg.packageRoot
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
