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
for (const relativePath of requiredPaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error("Missing compliance files:");
  for (const p of missing) {
    console.error(`- ${p}`);
  }
  process.exitCode = 1;
} else {
  console.log("Compliance file check passed.");
}
