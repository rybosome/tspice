import { sortViolations } from "./sortViolations.js";
import type { RepoStandardsReport } from "../engine/types.js";

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
