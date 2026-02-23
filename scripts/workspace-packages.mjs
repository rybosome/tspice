import fs from "node:fs/promises";
import { glob } from "node:fs/promises";
import path from "node:path";

const DEFAULT_WORKSPACE_FILE = "pnpm-workspace.yaml";

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function stripInlineComment(line) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return line.slice(0, i).trimEnd();
    }
  }

  return line.trimEnd();
}

function unquote(value) {
  if (value.length < 2) {
    return value;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseWorkspacePackagePatterns(workspaceRaw) {
  const lines = workspaceRaw.split(/\r?\n/);
  const patterns = [];

  let inPackagesSection = false;

  for (const rawLine of lines) {
    const line = stripInlineComment(rawLine);

    if (!inPackagesSection) {
      if (/^\s*packages\s*:\s*$/.test(line)) {
        inPackagesSection = true;
      }
      continue;
    }

    if (/^\s*$/.test(line)) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const match = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }

    const pattern = unquote(match[1].trim());
    if (pattern.length === 0) {
      continue;
    }

    patterns.push(pattern);
  }

  return patterns;
}

export async function readWorkspacePackagePatterns(workspaceFile = DEFAULT_WORKSPACE_FILE) {
  const workspacePath = path.resolve(workspaceFile);
  const workspaceRaw = await fs.readFile(workspacePath, "utf8");

  const patterns = parseWorkspacePackagePatterns(workspaceRaw);
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

  if (included.length === 0) {
    throw new Error(`Workspace pattern list in ${workspaceFile} has no included entries`);
  }

  const includeManifestPatterns = included.map(toManifestPattern);
  const excludeManifestPatterns = excluded.map(toManifestPattern);

  const manifestPathSet = new Set();

  for await (const manifestPath of glob(includeManifestPatterns, {
    cwd: process.cwd(),
    exclude: excludeManifestPatterns,
  })) {
    manifestPathSet.add(normalizePath(manifestPath));
  }

  const manifestPaths = Array.from(manifestPathSet).sort((a, b) => a.localeCompare(b));

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
