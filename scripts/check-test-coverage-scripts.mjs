import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE_DIRECTORIES = ["apps", "packages", "fixtures"];

// Intentionally out of initial coverage-script scope for issue #522.
const EXCLUDED_FROM_INITIAL_COVERAGE = new Set([
  "@rybosome/orrery",
  "@rybosome/tspice-bench-contract",
]);

function hasVitestTestScript(scripts) {
  if (!scripts || typeof scripts.test !== "string") {
    return false;
  }

  return /\bvitest\b/.test(scripts.test);
}

async function listPackageManifests() {
  const manifests = [];

  for (const workspaceDir of WORKSPACE_DIRECTORIES) {
    const workspacePath = path.resolve(workspaceDir);

    let dirEntries = [];
    try {
      dirEntries = await fs.readdir(workspacePath, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    for (const dirEntry of dirEntries) {
      if (!dirEntry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(workspacePath, dirEntry.name, "package.json");

      try {
        const manifestRaw = await fs.readFile(manifestPath, "utf8");
        manifests.push({
          manifestPath: path.relative(process.cwd(), manifestPath),
          manifest: JSON.parse(manifestRaw),
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }
  }

  return manifests;
}

async function main() {
  const manifests = await listPackageManifests();

  const missingCoverageScripts = [];

  for (const { manifestPath, manifest } of manifests) {
    const scripts = manifest.scripts ?? {};

    if (!hasVitestTestScript(scripts)) {
      continue;
    }

    if (EXCLUDED_FROM_INITIAL_COVERAGE.has(manifest.name)) {
      continue;
    }

    if (typeof scripts["test:coverage"] !== "string" || scripts["test:coverage"].trim().length === 0) {
      missingCoverageScripts.push({
        packageName: manifest.name,
        manifestPath,
      });
    }
  }

  if (missingCoverageScripts.length === 0) {
    console.log("All Vitest packages in coverage scope declare test:coverage.");
    return;
  }

  console.error("Missing test:coverage scripts for Vitest packages in coverage scope:");
  for (const entry of missingCoverageScripts) {
    console.error(`- ${entry.packageName} (${entry.manifestPath})`);
  }

  process.exit(1);
}

await main();
