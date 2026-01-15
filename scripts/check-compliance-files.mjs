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

const missingOrUnreadable = [];
for (const relativePath of requiredPaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      throw new Error("Not a file");
    }
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    missingOrUnreadable.push({ path: relativePath, error });
  }
}

if (missingOrUnreadable.length > 0) {
  console.error("Missing or unreadable compliance files:");
  for (const entry of missingOrUnreadable) {
    console.error(
      `- ${entry.path}: ${entry.error instanceof Error ? entry.error.message : String(entry.error)}`,
    );
  }
  process.exit(1);
}

console.log("Compliance file check passed.");
