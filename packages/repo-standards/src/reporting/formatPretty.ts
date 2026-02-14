import { sortViolations } from "./sortViolations.js";
import type { RepoStandardsReport, Violation } from "../engine/types.js";

function formatLocation(v: Violation): string {
  const loc = v.location ?? {};
  if (loc.filePath && typeof loc.line === "number" && typeof loc.col === "number") {
    return `${loc.filePath}:${loc.line}:${loc.col}`;
  }
  if (loc.filePath && typeof loc.line === "number") {
    return `${loc.filePath}:${loc.line}`;
  }
  if (loc.filePath) return loc.filePath;
  if (loc.callId) return loc.callId;
  return "";
}

/** Format a repo-standards report as a human-friendly plain-text summary. */
export function formatPrettyReport(report: RepoStandardsReport): string {
  const sorted = sortViolations(report.violations);

  if (sorted.length === 0) {
    return [
      "Repo standards: no violations",
      `repoRoot: ${report.repoRoot}`,
      `configPath: ${report.configPath}`
    ].join("\n");
  }

  const lines: string[] = [];
  lines.push(`Repo standards: ${sorted.length} violation(s)`);
  lines.push(`repoRoot: ${report.repoRoot}`);
  lines.push(`configPath: ${report.configPath}`);

  let currentRule: string | undefined;
  let currentPkg: string | undefined;

  for (const v of sorted) {
    if (v.ruleId !== currentRule) {
      currentRule = v.ruleId;
      currentPkg = undefined;
      lines.push("");
      lines.push(`Rule: ${v.ruleId}`);
    }

    if (v.packageRoot !== currentPkg) {
      currentPkg = v.packageRoot;
      lines.push(`  Package: ${v.packageRoot}`);
    }

    const loc = formatLocation(v);
    lines.push(`    - ${loc ? `${loc} ` : ""}${v.message}`.trimEnd());
  }

  return lines.join("\n");
}
