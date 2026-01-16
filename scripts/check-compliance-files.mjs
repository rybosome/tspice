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

function describeError(error) {
  if (error instanceof Error) {
    const code =
      typeof error.code === "string" && error.code !== "" ? error.code : undefined;
    return {
      code,
      message: error.message,
    };
  }

  return {
    code: undefined,
    message: String(error),
  };
}

const missingOrUnreadable = [];
for (const relativePath of requiredPaths) {
  if (path.isAbsolute(relativePath)) {
    missingOrUnreadable.push({
      path: relativePath,
      error: { code: "EABSOLUTE", message: "Path must be repo-relative" },
    });
    continue;
  }

  const absolutePath = path.resolve(repoRoot, relativePath);
  const repoRelative = path.relative(repoRoot, absolutePath);
  if (
    repoRelative === ".." ||
    repoRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(repoRelative)
  ) {
    missingOrUnreadable.push({
      path: relativePath,
      error: { code: "EOUTSIDE", message: "Path must be inside repo root" },
    });
    continue;
  }

  try {
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      missingOrUnreadable.push({
        path: relativePath,
        error: { code: "ENOTFILE", message: "Not a file" },
      });
      continue;
    }
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    missingOrUnreadable.push({ path: relativePath, error: describeError(error) });
  }
}

if (missingOrUnreadable.length > 0) {
  console.error("Missing or unreadable compliance files:");
  for (const entry of missingOrUnreadable) {
    const errorInfo = entry.error;
    const codeSuffix = errorInfo.code ? ` (${errorInfo.code})` : "";
    console.error(`- ${entry.path}${codeSuffix} ${errorInfo.message}`);
  }
  process.exit(1);
}

console.log("Compliance file check passed.");
