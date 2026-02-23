import fs from "node:fs/promises";
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

async function listAllPackageManifests(cwd) {
  const manifestPaths = [];

  async function walk(relativeDirectory) {
    const directoryPath = relativeDirectory.length === 0 ? cwd : path.resolve(cwd, relativeDirectory);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

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

  await walk("");
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

  const manifestPaths = await listAllPackageManifests(cwd);
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
