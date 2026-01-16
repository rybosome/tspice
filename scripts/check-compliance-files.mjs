import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      message: error.message === "" ? "Unknown error" : String(error.message),
    };
  }

  if (typeof error === "object" && error !== null) {
    const rawCode = "code" in error ? error.code : undefined;
    const code =
      typeof rawCode === "string" && rawCode !== ""
        ? rawCode
        : typeof rawCode === "number"
          ? String(rawCode)
          : undefined;
    const rawMessage = "message" in error ? error.message : undefined;
    const message =
      typeof rawMessage === "string" || typeof rawMessage === "number"
        ? String(rawMessage)
        : undefined;

    if (message !== undefined && message !== "") {
      return { code, message };
    }
  }

  const message = String(error);
  return {
    code: undefined,
    message: message === "" ? "Unknown error" : message,
  };
}

function isOutsideRoot(root, target) {
  const rel = path.relative(root, target);
  return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

let realRepoRoot;
try {
  realRepoRoot = fs.realpathSync(repoRoot);
} catch (error) {
  const err = describeError(error);
  const codeSuffix = err.code ? ` (${err.code})` : "";
  console.error("Configuration error resolving repo root (realpath):");
  console.error(`- ${repoRoot}${codeSuffix}: ${err.message}`);
  process.exit(1);
}

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
  if (isOutsideRoot(repoRoot, absolutePath)) {
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
    const realAbsolutePath = fs.realpathSync(absolutePath);
    if (isOutsideRoot(realRepoRoot, realAbsolutePath)) {
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

    const stats = fs.statSync(realAbsolutePath);
    if (!stats.isFile()) {
      const fileType = stats.isDirectory() ? "directory" : "non-regular file";
      missingOrUnreadable.push({
        path: relativePath,
        error: {
          code: "ENOTFILE",
          message: `Expected a regular file but found ${fileType}`,
        },
      });
      if (stats.isDirectory()) {
        hasConfigError = true;
      }
      continue;
    }

    fs.accessSync(realAbsolutePath, fs.constants.R_OK);
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
    const errorInfo = entry.error;
    const codeSuffix = errorInfo.code ? ` (${errorInfo.code})` : "";
    console.error(`- ${entry.path}${codeSuffix}: ${errorInfo.message}`);
  }
  process.exit(1);
}

console.log("Compliance file check passed.");
