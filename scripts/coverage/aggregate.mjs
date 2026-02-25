import fs from "node:fs/promises";
import path from "node:path";

import { listWorkspacePackageManifests } from "../workspace-packages.mjs";

const METRICS = ["lines", "statements", "functions", "branches"];

const JSON_OUTPUT_PATH = process.env.COVERAGE_REPORT_JSON ?? "coverage/coverage-report.json";
const MARKDOWN_OUTPUT_PATH =
  process.env.COVERAGE_REPORT_MARKDOWN ?? "coverage/coverage-report.md";

const ALLOW_MISSING_SUMMARIES = process.env.COVERAGE_ALLOW_MISSING === "1";

function emptyMetric() {
  return {
    total: 0,
    covered: 0,
    skipped: 0,
    pct: null,
  };
}

function emptySummaryTotals() {
  return {
    lines: emptyMetric(),
    statements: emptyMetric(),
    functions: emptyMetric(),
    branches: emptyMetric(),
  };
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function addMetric(target, source) {
  target.total += toNumber(source?.total);
  target.covered += toNumber(source?.covered);
  target.skipped += toNumber(source?.skipped);
}

function finalizeMetric(metric) {
  if (metric.total === 0) {
    return {
      total: metric.total,
      covered: metric.covered,
      skipped: metric.skipped,
      pct: null,
    };
  }

  const pct = (metric.covered / metric.total) * 100;

  return {
    total: metric.total,
    covered: metric.covered,
    skipped: metric.skipped,
    pct: Number(pct.toFixed(2)),
  };
}

function finalizeSummaryTotals(rawTotals) {
  const totals = emptySummaryTotals();

  for (const metricName of METRICS) {
    addMetric(totals[metricName], rawTotals?.[metricName]);
    totals[metricName] = finalizeMetric(totals[metricName]);
  }

  return totals;
}

function aggregateLens(lensName, entries) {
  const totals = emptySummaryTotals();

  for (const entry of entries) {
    if (!entry?.summary || typeof entry.summary !== "object" || !entry.summary.total) {
      const entryName = typeof entry?.name === "string" ? entry.name : "<unknown>";
      throw new Error(
        `aggregateLens(${lensName}) expected observed entries with summary.total; received invalid entry for ${entryName}`,
      );
    }

    for (const metricName of METRICS) {
      addMetric(totals[metricName], entry.summary.total?.[metricName]);
    }
  }

  const finalizedTotals = {};
  for (const metricName of METRICS) {
    finalizedTotals[metricName] = finalizeMetric(totals[metricName]);
  }

  return {
    lens: lensName,
    packageCount: entries.length,
    packages: entries.map((entry) => entry.name),
    totals: finalizedTotals,
  };
}

function formatMetric(metric) {
  if (metric.pct === null) {
    return "n/a";
  }

  return `${metric.pct.toFixed(2)}% (${metric.covered}/${metric.total})`;
}

function hasCoverageScript(manifest) {
  return (
    typeof manifest.scripts?.["test:coverage"] === "string" &&
    manifest.scripts["test:coverage"].trim().length > 0
  );
}

async function listCoverageTargets() {
  const manifests = await listWorkspacePackageManifests();

  const targets = manifests
    .filter(({ manifest }) => hasCoverageScript(manifest))
    .map(({ manifestPath, packagePath, manifest }) => ({
      name:
        typeof manifest.name === "string" && manifest.name.trim().length > 0
          ? manifest.name
          : packagePath,
      packagePath,
      manifestPath,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (targets.length === 0) {
    throw new Error("No coverage targets discovered from workspace manifests.");
  }

  return targets;
}

async function readCoverageSummary(target) {
  const summaryPath = path.join(target.packagePath, "coverage", "coverage-summary.json");

  try {
    const summaryRaw = await fs.readFile(summaryPath, "utf8");
    const summary = JSON.parse(summaryRaw);

    if (!summary || typeof summary !== "object" || !summary.total) {
      throw new Error(`Missing \`total\` object in ${summaryPath}`);
    }

    return {
      ...target,
      summaryPath,
      summary,
      missing: false,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        ...target,
        summaryPath,
        missing: true,
      };
    }

    throw error;
  }
}

function toMarkdown(report) {
  const allUnit = report.views.allUnitTests;

  const observedPackages =
    report.observedPackages.length === 0
      ? "- none"
      : report.observedPackages
          .map((pkg) => `- ${pkg.name} (${pkg.summaryPath})`)
          .join("\n");

  const missingSummaries =
    report.missingSummaries.length === 0
      ? "- none"
      : report.missingSummaries
          .map((entry) => `- ${entry.name} (${entry.summaryPath})`)
          .join("\n");

  const packageSummaries =
    report.packageSummaries.length === 0
      ? "- none"
      : [
          "| Package | Lines | Statements | Functions | Branches |",
          "| --- | ---: | ---: | ---: | ---: |",
          ...report.packageSummaries.map(
            (entry) =>
              `| ${entry.name} | ${formatMetric(entry.totals.lines)} | ${formatMetric(entry.totals.statements)} | ${formatMetric(entry.totals.functions)} | ${formatMetric(entry.totals.branches)} |`,
          ),
        ].join("\n");

  const incompleteNotice = report.complete
    ? ""
    : [
        "",
        `⚠️ Incomplete coverage report: ${report.missingSummaries.length}/${report.targets.length} target summaries are missing.`,
      ].join("\n");

  return [
    "## Coverage summary (report-only)",
    incompleteNotice,
    "",
    "| Summary | Package count | Lines | Statements | Functions | Branches |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| ${allUnit.lens} | ${allUnit.packageCount} | ${formatMetric(allUnit.totals.lines)} | ${formatMetric(allUnit.totals.statements)} | ${formatMetric(allUnit.totals.functions)} | ${formatMetric(allUnit.totals.branches)} |`,
    "",
    "### Package coverage summaries",
    packageSummaries,
    "",
    "### Coverage inputs",
    observedPackages,
    "",
    "### Missing coverage summaries",
    missingSummaries,
  ].join("\n");
}

async function main() {
  const coverageTargets = await listCoverageTargets();

  const coverageResults = await Promise.all(coverageTargets.map(readCoverageSummary));

  const observed = coverageResults.filter((entry) => !entry.missing);
  const missing = coverageResults.filter((entry) => entry.missing);

  if (missing.length > 0 && !ALLOW_MISSING_SUMMARIES) {
    const missingDetails = missing
      .map((entry) => `${entry.name} (${entry.summaryPath})`)
      .join(", ");

    throw new Error(
      `Missing coverage summaries for ${missing.length}/${coverageTargets.length} targets: ${missingDetails}. ` +
        "Set COVERAGE_ALLOW_MISSING=1 to emit an incomplete report instead.",
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    allowMissingSummaries: ALLOW_MISSING_SUMMARIES,
    complete: missing.length === 0,
    targets: coverageTargets.map((target) => target.name),
    observedPackages: observed.map((entry) => ({
      name: entry.name,
      summaryPath: entry.summaryPath,
      manifestPath: entry.manifestPath,
    })),
    packageSummaries: observed.map((entry) => ({
      name: entry.name,
      summaryPath: entry.summaryPath,
      manifestPath: entry.manifestPath,
      totals: finalizeSummaryTotals(entry.summary.total),
    })),
    missingSummaries: missing.map((entry) => ({
      name: entry.name,
      summaryPath: entry.summaryPath,
      manifestPath: entry.manifestPath,
    })),
    views: {
      allUnitTests: aggregateLens("all-unit-tests", observed),
    },
  };

  const markdown = toMarkdown(report);

  await fs.mkdir(path.dirname(JSON_OUTPUT_PATH), { recursive: true });
  await fs.mkdir(path.dirname(MARKDOWN_OUTPUT_PATH), { recursive: true });

  await fs.writeFile(JSON_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(MARKDOWN_OUTPUT_PATH, `${markdown}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log("\n");
  console.log(markdown);
}

await main();
