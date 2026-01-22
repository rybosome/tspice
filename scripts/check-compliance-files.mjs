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
    const message = rawMessage == null ? undefined : String(rawMessage);

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
  // Returns true if `target` is outside `root` when interpreted on the local
  // filesystem. Covers `..` escapes and cross-root resolutions (e.g., different
  // drive letters on Windows).
  const rel = path.relative(root, target);
  if (rel === "" || rel === ".") {
    return false;
  }
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
* These files are linked from compliance-oriented documentation. If any move,
* we should fail CI so the "see notices" chain doesn't silently break.
*
* All entries must be repo-relative and must resolve inside the repo root after
* following symlinks.
*/
const complianceDocs = [
  path.join("docs", "cspice-policy.md"),
  path.join("docs", "cspice-naif-disclosure.md"),
];

const linkedFromDocs = new Set();
const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g;

for (const docRel of complianceDocs) {
  const docAbs = path.resolve(repoRoot, docRel);
  const docDir = path.dirname(docAbs);

  try {
    const raw = fs.readFileSync(docAbs, "utf8");
    for (const match of raw.matchAll(markdownLink)) {
      const rawTarget = match[1]?.trim() ?? "";
      if (
        rawTarget === "" ||
        rawTarget.startsWith("#") ||
        rawTarget.startsWith("mailto:") ||
        rawTarget.includes("://")
      ) {
        continue;
      }

      const [target, ...rest] = rawTarget.split("#");
      if (rest.length > 0 && target === "") {
        continue;
      }

      // Only enforce links that point at repo files.
      if (target.startsWith("/")) {
        linkedFromDocs.add(path.relative(repoRoot, path.resolve(repoRoot, target.slice(1))));
        continue;
      }

      if (target.startsWith("./") || target.startsWith("../")) {
        linkedFromDocs.add(path.relative(repoRoot, path.resolve(docDir, target)));
        continue;
      }
    }
  } catch {
    // The doc itself is validated below.
  }
}

const requiredPaths = [
  ...new Set([
    "THIRD_PARTY_NOTICES.md",
    ...complianceDocs,
    path.join("packages", "backend-node", "NOTICE"),
    path.join("packages", "backend-wasm", "NOTICE"),
    ...linkedFromDocs,
  ]),
];

const missingOrUnreadable = [];

for (const relativePath of requiredPaths) {
  if (path.isAbsolute(relativePath)) {
    missingOrUnreadable.push({
      path: relativePath,
      error: {
        code: "EABSOLUTE",
        message: "Path in requiredPaths must be repo-relative (configuration error)",
      },
    });
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
      continue;
    }

    fs.accessSync(realAbsolutePath, fs.constants.R_OK);
  } catch (error) {
    missingOrUnreadable.push({ path: relativePath, error: describeError(error) });
  }
}

const hasConfigError = missingOrUnreadable.some((entry) =>
  ["EABSOLUTE", "EOUTSIDE", "ENOTFILE"].includes(entry.error.code ?? ""),
);

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
