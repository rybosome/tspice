import fs from "node:fs/promises";
import path from "node:path";

const COVERAGE_TARGETS = [
  {
    name: "@rybosome/tspice-backend-contract",
    packagePath: "packages/backend-contract",
  },
  {
    name: "@rybosome/tspice-backend-fake",
    packagePath: "packages/backend-fake",
  },
  {
    name: "@rybosome/tspice-backend-node",
    packagePath: "packages/backend-node",
  },
  {
    name: "@rybosome/tspice-backend-wasm",
    packagePath: "packages/backend-wasm",
  },
  {
    name: "@rybosome/tspice-core",
    packagePath: "packages/core",
  },
  {
    name: "@rybosome/tspice-parity-checking",
    packagePath: "packages/parity-checking",
  },
  {
    name: "@rybosome/tspice",
    packagePath: "packages/tspice",
  },
];

const PARITY_PACKAGE_NAME = "@rybosome/tspice-parity-checking";
const JS_ONLY_EXCLUDED_PACKAGES = new Set(["@rybosome/tspice-backend-node"]);
const METRICS = ["lines", "statements", "functions", "branches"];

const JSON_OUTPUT_PATH = process.env.COVERAGE_REPORT_JSON ?? "coverage/coverage-report.json";
const MARKDOWN_OUTPUT_PATH =
  process.env.COVERAGE_REPORT_MARKDOWN ?? "coverage/coverage-report.md";

function emptyMetric() {
  return {
    total: 0,
    covered: 0,
    skipped: 0,
    pct: 100,
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
  const pct = metric.total === 0 ? 100 : (metric.covered / metric.total) * 100;

  return {
    total: metric.total,
    covered: metric.covered,
    skipped: metric.skipped,
    pct: Number(pct.toFixed(2)),
  };
}

function aggregateLens(lensName, entries) {
  const totals = emptySummaryTotals();

  for (const entry of entries) {
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

function formatMetric(metric) {
  return `${metric.pct.toFixed(2)}% (${metric.covered}/${metric.total})`;
}

function toMarkdown(report) {
  const { repo, parity, nonParity, jsOnly } = report.lenses;
  const rows = [repo, parity, nonParity, jsOnly]
    .map(
      (lens) =>
        `| ${lens.lens} | ${lens.packageCount} | ${formatMetric(lens.totals.lines)} | ${formatMetric(lens.totals.statements)} | ${formatMetric(lens.totals.functions)} | ${formatMetric(lens.totals.branches)} |`,
    )
    .join("\n");

  const observedPackages =
    report.observedPackages.length === 0
      ? "- none"
      : report.observedPackages.map((pkg) => `- ${pkg.name} (${pkg.summaryPath})`).join("\n");

  const missingSummaries =
    report.missingSummaries.length === 0
      ? "- none"
      : report.missingSummaries
          .map((entry) => `- ${entry.name} (${entry.summaryPath})`)
          .join("\n");

  return [
    "## Coverage summary (report-only)",
    "",
    "| Lens | Package count | Lines | Statements | Functions | Branches |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    rows,
    "",
    "### Coverage inputs",
    observedPackages,
    "",
    "### Missing coverage summaries",
    missingSummaries,
  ].join("\n");
}

async function main() {
  const coverageResults = await Promise.all(COVERAGE_TARGETS.map(readCoverageSummary));

  const observed = coverageResults.filter((entry) => !entry.missing);
  const missing = coverageResults.filter((entry) => entry.missing);

  const report = {
    generatedAt: new Date().toISOString(),
    targets: COVERAGE_TARGETS.map((target) => target.name),
    observedPackages: observed.map((entry) => ({
      name: entry.name,
      summaryPath: entry.summaryPath,
    })),
    missingSummaries: missing.map((entry) => ({
      name: entry.name,
      summaryPath: entry.summaryPath,
    })),
    lenses: {
      repo: aggregateLens("repo", observed),
      parity: aggregateLens(
        "parity",
        observed.filter((entry) => entry.name === PARITY_PACKAGE_NAME),
      ),
      nonParity: aggregateLens(
        "non-parity",
        observed.filter((entry) => entry.name !== PARITY_PACKAGE_NAME),
      ),
      jsOnly: aggregateLens(
        "js-only",
        observed.filter((entry) => !JS_ONLY_EXCLUDED_PACKAGES.has(entry.name)),
      ),
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
