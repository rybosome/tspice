// Smoke test for @rybosome/tspice with a native optionalDependency installed.
//
// Intended to be run from inside a throwaway temp project in CI.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Find the nearest directory at/above `startDir` that contains a `package.json`.
 *
 * This script is executed from the repo, but `cwd` should be the temp project
 * where the tarballs are installed.
 */
function findNodeProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  // Guard against infinite loops; once `dirname(dir) === dir`, we've hit FS root.
  // (works on POSIX; on Windows, path.resolve normalizes drive roots similarly.)
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const startCwd = process.cwd();
const projectRoot = findNodeProjectRoot(startCwd);

if (!projectRoot) {
  throw new Error(
    [
      "Smoke test must be run with cwd set to a Node project (directory containing package.json).",
      `Got cwd: ${startCwd}`,
      "Tip: run this script from inside the temp project root created by the release workflow.",
    ].join("\n"),
  );
}

const projectPackageJsonPath = path.join(projectRoot, "package.json");
const projectPackageJsonUrl = pathToFileURL(projectPackageJsonPath).href;

console.log("[smoke] cwd:", startCwd);
console.log("[smoke] project root:", projectRoot);

const tspiceSpecifier = "@rybosome/tspice";

let tspiceResolved;
let resolutionMethod;
// `import.meta.resolve()` is implemented in Node, but its signature/behavior has
// been inconsistent across Node versions (notably: the 2nd arg may be ignored,
// which would resolve relative to this script instead of the temp project).
//
// Prefer deterministic resolution anchored to the temp project.
const requireFromProject = createRequire(projectPackageJsonPath);

function resolveViaRequire() {
  const resolvedPath = requireFromProject.resolve(tspiceSpecifier);
  return pathToFileURL(resolvedPath).href;
}

function isPathInside(baseDir, candidatePath) {
  const rel = path.relative(baseDir, candidatePath);
  // `path.relative()` can return paths starting with `..` when the candidate is
  // outside. Guard against also returning an absolute path (e.g. different drive
  // letters on Windows).
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isTempProjectResolution(resolvedUrl) {
  try {
    const resolvedFileUrl = new URL(resolvedUrl);
    if (resolvedFileUrl.protocol !== "file:") return false;

    const resolvedFsPath = fileURLToPath(resolvedFileUrl);
    // The package should resolve from within the temp project's node_modules.
    const nodeModulesDir = path.resolve(projectRoot, "node_modules");
    return isPathInside(nodeModulesDir, resolvedFsPath) && fs.existsSync(resolvedFsPath);
  } catch {
    return false;
  }
}

try {
  const candidate = resolveViaRequire();
  if (!isTempProjectResolution(candidate)) {
    throw new Error("createRequire(...).resolve() resolved outside temp project");
  }
  tspiceResolved = candidate;
  resolutionMethod = "createRequire(...).resolve";
} catch {
  if (typeof import.meta.resolve === "function") {
    const candidate = import.meta.resolve(tspiceSpecifier, projectPackageJsonUrl);
    if (isTempProjectResolution(candidate)) {
      tspiceResolved = candidate;
      resolutionMethod = "import.meta.resolve(parentURL) (fallback)";
    } else {
      throw new Error(
        "Failed to resolve @rybosome/tspice from temp project via createRequire() or import.meta.resolve(parentURL)",
      );
    }
  } else {
    throw new Error(
      "Failed to resolve @rybosome/tspice from temp project via createRequire(); import.meta.resolve is unavailable",
    );
  }
}

console.log(

  `[smoke] resolving ${tspiceSpecifier} via ${resolutionMethod} => ${tspiceResolved}`,
);

const mod = await import(tspiceResolved);
console.log("[smoke] @rybosome/tspice export keys:", Object.keys(mod));
console.log("[smoke] createBackend typeof:", typeof mod.createBackend);

const { createBackend } = mod;
const backend = await createBackend({ backend: "node" });

console.log("[smoke] backend typeof:", typeof backend);
console.log(
  "[smoke] backend keys:",
  Object.keys(backend).length,
  Object.keys(backend).slice(0, 25),
);
console.log("[smoke] backend.kind:", backend.kind);

if (backend.kind !== "node") {
  console.log("backend value:", backend);
  throw new Error(`Expected backend.kind to be "node"; got: ${backend.kind}`);
}

const version = backend.spiceVersion();
if (typeof version !== "string" || version.length === 0) {
  throw new Error(
    `Expected spiceVersion() to return a non-empty string; got: ${String(version)}`,
  );
}

console.log(
  `[smoke] Native backend loaded OK. CSPICE toolkit version: ${version}`,
);
