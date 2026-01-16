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
    const rawCode = error.code;
    const code =
      typeof rawCode === "string" && rawCode !== ""
        ? rawCode
        : typeof rawCode === "number"
          ? String(rawCode)
          : undefined;
    return {
      code,
      message: String(error.message ?? ""),
    };
  }

  if (typeof error === "object" && error !== null) {
    const rawMessage = "message" in error ? error.message : undefined;
    const rawCode = "code" in error ? error.code : undefined;
    const message =
      typeof rawMessage === "string" || typeof rawMessage === "number"
        ? String(rawMessage)
        : undefined;
    const code =
      typeof rawCode === "string" && rawCode !== ""
        ? rawCode
        : typeof rawCode === "number"
          ? String(rawCode)
          : undefined;

    if (message !== undefined) {
      return { code, message };
    }
  }

  return {
    code: undefined,
    message: String(error),
  };
}

const missingOrUnreadable = [];
let hasConfigError = false;

for (const relativePath of requiredPaths) {
  if (path.isAbsolute(relativePath)) {
    missingOrUnreadable.push({
      path: relativePath,
      error: {
        code: "EABSOLUTE",
        message: "Path in requiredPaths must be repo-relative (configuration error)",
      },
    });
    hasConfigError = true;
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
      error: {
        code: "EOUTSIDE",
        message:
          "Path in requiredPaths must resolve inside repo root (configuration error)",
      },
    });
    hasConfigError = true;
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
  console.error(
    hasConfigError
      ? "Configuration error in compliance file list (requiredPaths):"
      : "Missing or unreadable compliance files:",
  );
  for (const entry of missingOrUnreadable) {
    const errorInfo = describeError(entry.error);
    const codeSuffix = errorInfo.code ? ` (${errorInfo.code})` : "";
    console.error(`- ${entry.path}${codeSuffix}: ${errorInfo.message}`);
  }
  process.exit(1);
}

console.log("Compliance file check passed.");
