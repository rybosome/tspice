import { listWorkspacePackageManifests } from "./workspace-packages.mjs";

// Intentionally out of initial coverage-script scope for issue #522.
const EXCLUDED_FROM_INITIAL_COVERAGE = new Set([
  "@rybosome/orrery",
  "@rybosome/tspice-bench-contract",
]);

function hasVitestDependency(manifest) {
  const dependencies = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };

  return Object.keys(dependencies).some(
    (dependencyName) => dependencyName === "vitest" || dependencyName.startsWith("@vitest/"),
  );
}

function hasCoverageScript(scripts) {
  return typeof scripts?.["test:coverage"] === "string" && scripts["test:coverage"].trim().length > 0;
}

async function main() {
  const manifests = await listWorkspacePackageManifests();

  const missingCoverageScripts = [];

  for (const { manifestPath, manifest } of manifests) {
    const packageName =
      typeof manifest.name === "string" && manifest.name.trim().length > 0
        ? manifest.name
        : manifestPath;

    if (EXCLUDED_FROM_INITIAL_COVERAGE.has(packageName)) {
      continue;
    }

    if (!hasVitestDependency(manifest)) {
      continue;
    }

    if (!hasCoverageScript(manifest.scripts)) {
      missingCoverageScripts.push({
        packageName,
        manifestPath,
      });
    }
  }

  if (missingCoverageScripts.length === 0) {
    console.log("All Vitest dependency packages in coverage scope declare test:coverage.");
    return;
  }

  console.error("Missing test:coverage scripts for Vitest dependency packages in coverage scope:");
  for (const entry of missingCoverageScripts) {
    console.error(`- ${entry.packageName} (${entry.manifestPath})`);
  }

  process.exit(1);
}

await main();
