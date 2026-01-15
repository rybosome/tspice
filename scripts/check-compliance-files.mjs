import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

/**
* These files are linked from compliance-oriented documentation. If any move, we
* should fail CI so the "see notices" chain doesn't silently break.
*/
const requiredPaths = [
  "THIRD_PARTY_NOTICES.md",
  path.join("packages", "backend-node", "NOTICE"),
  path.join("packages", "backend-wasm", "NOTICE"),
];

const missing = [];
const errors = [];
for (const relativePath of requiredPaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    fs.statSync(absolutePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      missing.push(relativePath);
      continue;
    }
    errors.push({ path: relativePath, error });
  }
}

if (missing.length > 0 || errors.length > 0) {
  if (missing.length > 0) {
    console.error("Missing compliance files:");
    for (const p of missing) {
      console.error(`- ${p}`);
    }
  }
  if (errors.length > 0) {
    console.error("Compliance file check errors:");
    for (const entry of errors) {
      console.error(`- ${entry.path}: ${entry.error instanceof Error ? entry.error.message : String(entry.error)}`);
    }
  }
  process.exitCode = 1;
} else {
  console.log("Compliance file check passed.");
}
