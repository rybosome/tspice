import fs from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

const DEFAULT_WORKSPACE_FILE = "pnpm-workspace.yaml";

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

export function parseWorkspacePackagePatterns(workspaceRaw) {
  let workspaceDocument;

  try {
    workspaceDocument = parseYaml(workspaceRaw);
  } catch (error) {
    throw new Error("Failed to parse workspace YAML", { cause: error });
  }

  if (!workspaceDocument || typeof workspaceDocument !== "object" || Array.isArray(workspaceDocument)) {
    throw new Error("Workspace YAML must parse to an object containing a `packages` array");
  }

  const packagePatterns = workspaceDocument.packages;
  if (!Array.isArray(packagePatterns)) {
    throw new Error("Workspace YAML field `packages` must be an array");
  }

  return packagePatterns.map((pattern, index) => {
    if (typeof pattern !== "string") {
      throw new Error(`Workspace package pattern at index ${index} must be a string`);
    }

    const normalizedPattern = pattern.trim();
    if (normalizedPattern.length === 0) {
      throw new Error(`Workspace package pattern at index ${index} must not be empty`);
    }

    return normalizedPattern;
  });
}

export async function readWorkspacePackagePatterns(workspaceFile = DEFAULT_WORKSPACE_FILE) {
  const workspacePath = path.resolve(workspaceFile);
  const workspaceRaw = await fs.readFile(workspacePath, "utf8");

  let patterns;

  try {
    patterns = parseWorkspacePackagePatterns(workspaceRaw);
  } catch (error) {
    throw new Error(`Failed to parse workspace package patterns from ${workspaceFile}`, { cause: error });
  }

  if (patterns.length === 0) {
    throw new Error(`No workspace package patterns found in ${workspaceFile}`);
  }

  return patterns;
}

function toManifestPattern(workspacePattern) {
  const normalized = normalizePath(workspacePattern).replace(/\/+$/, "");

  if (normalized === "" || normalized === ".") {
    return "package.json";
  }

  if (normalized.endsWith("/package.json") || normalized === "package.json") {
    return normalized;
  }

  return `${normalized}/package.json`;
}

function splitWorkspacePatterns(patterns) {
  const included = [];
  const excluded = [];

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      const negatedPattern = pattern.slice(1).trim();
      if (negatedPattern.length > 0) {
        excluded.push(negatedPattern);
      }
      continue;
    }

    included.push(pattern);
  }

  return { included, excluded };
}

function escapeRegexCharacter(char) {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}

function globPatternToRegExp(pattern) {
  const normalizedPattern = normalizePath(pattern);
  let source = "^";

  for (let i = 0; i < normalizedPattern.length; i += 1) {
    const char = normalizedPattern[i];

    if (char === "*") {
      if (normalizedPattern[i + 1] === "*") {
        source += ".*";
        i += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegexCharacter(char);
  }

  source += "$";
  return new RegExp(source);
}

const WALK_SKIP_DIRECTORIES = new Set([".git", "node_modules"]);

for (const directoryName of [".cache", ".turbo", "build", "coverage", "dist", "out"]) {
  WALK_SKIP_DIRECTORIES.add(directoryName);
}

function containsGlobSyntax(pathSegment) {
  return /[*?[]/.test(pathSegment);
}

function stripManifestSuffix(manifestPattern) {
  const normalized = normalizePath(manifestPattern);

  if (normalized === "package.json") {
    return "";
  }

  return normalized.endsWith("/package.json")
    ? normalized.slice(0, -"/package.json".length)
    : normalized;
}

function deriveFallbackWalkRoots(includeManifestPatterns) {
  const rootSet = new Set();

  for (const manifestPattern of includeManifestPatterns) {
    const packagePattern = stripManifestSuffix(manifestPattern);
    if (packagePattern.length === 0) {
      rootSet.add("");
      continue;
    }

    const segments = packagePattern.split("/").filter((segment) => segment.length > 0);
    const literalSegments = [];

    for (const segment of segments) {
      if (containsGlobSyntax(segment)) {
        break;
      }

      literalSegments.push(segment);
    }

    rootSet.add(literalSegments.join("/"));
  }

  const roots = Array.from(rootSet).map((root) => normalizePath(root).replace(/\/+$/, ""));
  roots.sort((a, b) => a.length - b.length || a.localeCompare(b));

  const dedupedRoots = [];
  for (const root of roots) {
    if (dedupedRoots.some((existingRoot) => existingRoot === "" || root === existingRoot || root.startsWith(`${existingRoot}/`))) {
      continue;
    }

    dedupedRoots.push(root);
  }

  return dedupedRoots.length > 0 ? dedupedRoots : [""];
}

async function listAllPackageManifests(cwd, roots = [""]) {
  const manifestPaths = [];
  const visitedDirectories = new Set();

  async function walk(relativeDirectory) {
    const normalizedDirectory = normalizePath(relativeDirectory).replace(/\/+$/, "");
    if (visitedDirectories.has(normalizedDirectory)) {
      return;
    }
    visitedDirectories.add(normalizedDirectory);

    const directoryPath = relativeDirectory.length === 0 ? cwd : path.resolve(cwd, relativeDirectory);
    let entries;

    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (WALK_SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }

        const childDirectory =
          relativeDirectory.length === 0 ? entry.name : `${relativeDirectory}/${entry.name}`;
        await walk(childDirectory);
        continue;
      }

      if (!entry.isFile() || entry.name !== "package.json") {
        continue;
      }

      const manifestPath =
        relativeDirectory.length === 0 ? entry.name : `${relativeDirectory}/${entry.name}`;
      manifestPaths.push(normalizePath(manifestPath));
    }
  }

  for (const root of roots) {
    await walk(root);
  }

  return manifestPaths;
}

async function globManifests(cwd, includeManifestPatterns, excludeManifestPatterns) {
  if (typeof fs.glob === "function") {
    const manifestPathSet = new Set();

    for await (const manifestPath of fs.glob(includeManifestPatterns, {
      cwd,
      exclude: excludeManifestPatterns,
    })) {
      manifestPathSet.add(normalizePath(manifestPath));
    }

    return Array.from(manifestPathSet).sort((a, b) => a.localeCompare(b));
  }

  const includeMatchers = includeManifestPatterns.map((pattern) => globPatternToRegExp(pattern));
  const excludeMatchers = excludeManifestPatterns.map((pattern) => globPatternToRegExp(pattern));
  const fallbackWalkRoots = deriveFallbackWalkRoots(includeManifestPatterns);

  const manifestPaths = await listAllPackageManifests(cwd, fallbackWalkRoots);
  const filteredManifestPaths = manifestPaths.filter((manifestPath) => {
    const included = includeMatchers.some((matcher) => matcher.test(manifestPath));
    if (!included) {
      return false;
    }

    return !excludeMatchers.some((matcher) => matcher.test(manifestPath));
  });

  return filteredManifestPaths.sort((a, b) => a.localeCompare(b));
}

async function readManifest(manifestPath) {
  const manifestRaw = await fs.readFile(manifestPath, "utf8");

  try {
    return JSON.parse(manifestRaw);
  } catch (error) {
    throw new Error(`Failed to parse JSON manifest at ${manifestPath}`, { cause: error });
  }
}

export async function listWorkspacePackageManifests(options = {}) {
  const workspaceFile = options.workspaceFile ?? DEFAULT_WORKSPACE_FILE;
  const workspacePatterns = await readWorkspacePackagePatterns(workspaceFile);
  const { included, excluded } = splitWorkspacePatterns(workspacePatterns);
  const cwd = process.cwd();

  if (included.length === 0) {
    throw new Error(`Workspace pattern list in ${workspaceFile} has no included entries`);
  }

  const includeManifestPatterns = included.map(toManifestPattern);
  const excludeManifestPatterns = excluded.map(toManifestPattern);
  const manifestPaths = await globManifests(cwd, includeManifestPatterns, excludeManifestPatterns);

  const manifests = [];
  for (const relativeManifestPath of manifestPaths) {
    const absoluteManifestPath = path.resolve(relativeManifestPath);
    const manifest = await readManifest(absoluteManifestPath);

    manifests.push({
      manifestPath: relativeManifestPath,
      packagePath: normalizePath(path.dirname(relativeManifestPath)),
      manifest,
    });
  }

  return manifests;
}
