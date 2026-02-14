import { sortViolations } from "./sortViolations.js";
import type { RepoStandardsReport } from "../engine/types.js";

/** Format a repo-standards report as deterministic pretty-printed JSON. */
export function formatJsonReport(report: RepoStandardsReport): string {
  const sorted = sortViolations(report.violations);
  return JSON.stringify(
    {
      repoRoot: report.repoRoot,
      configPath: report.configPath,
      violationCount: sorted.length,
      violations: sorted
    },
    null,
    2
  );
}
