import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_LIBS = ["lib/cspice.a", "lib/csupport.a"];
const REQUIRED_HEADER = "include/SpiceUsr.h";

function getRepoRoot() {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptsDir, "..");
}

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function listFilesRecursive(rootDir) {
  const out = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const abs = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      out.push(toPosix(path.relative(rootDir, abs)));
    }
  }

  walk(rootDir);
  return out.sort();
}

function hasArchiveLikeName(relPath) {
  const lower = relPath.toLowerCase();
  return (
    lower.endsWith(".tar") ||
    lower.endsWith(".tar.z") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".z")
  );
}

function assertDerivedOnlyCspiceCache(cacheRoot) {
  if (!fs.existsSync(cacheRoot)) {
    console.log(`[raw-naif-guard] cache path missing (nothing to validate): ${cacheRoot}`);
    return;
  }

  const stat = fs.statSync(cacheRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Expected cache root to be a directory: ${cacheRoot}`);
  }

  const files = listFilesRecursive(cacheRoot);
  if (files.length === 0) {
    console.log(`[raw-naif-guard] cache path is empty: ${cacheRoot}`);
    return;
  }

  const byTarget = new Map();

  for (const relPath of files) {
    if (hasArchiveLikeName(relPath)) {
      throw new Error(
        `Disallowed archive-like file in reusable CSPICE cache: ${path.join(cacheRoot, relPath)}`
      );
    }

    const parts = relPath.split("/");
    if (parts.length < 4) {
      throw new Error(`Unexpected file under reusable CSPICE cache: ${path.join(cacheRoot, relPath)}`);
    }

    const [toolkitVersion, target, cspiceSegment, ...restParts] = parts;
    if (!toolkitVersion || !target || cspiceSegment !== "cspice") {
      throw new Error(
        `Disallowed reusable CSPICE cache layout (expected <toolkit>/<target>/cspice/...): ${path.join(
          cacheRoot,
          relPath
        )}`
      );
    }

    if (!target.includes("-")) {
      throw new Error(
        `Disallowed target segment in reusable CSPICE cache (expected <platform>-<arch>): ${path.join(
          cacheRoot,
          relPath
        )}`
      );
    }

    const restPath = restParts.join("/");
    const allowed =
      restPath.startsWith("include/") ||
      restPath === "lib/cspice.a" ||
      restPath === "lib/csupport.a";

    if (!allowed) {
      throw new Error(
        `Disallowed file in reusable CSPICE cache (only include/** + lib/cspice.a + lib/csupport.a are allowed): ${path.join(
          cacheRoot,
          relPath
        )}`
      );
    }

    const key = `${toolkitVersion}/${target}`;
    const set = byTarget.get(key) ?? new Set();
    set.add(restPath);
    byTarget.set(key, set);
  }

  for (const [targetKey, filesForTarget] of byTarget) {
    for (const requiredLib of REQUIRED_LIBS) {
      if (!filesForTarget.has(requiredLib)) {
        throw new Error(
          `Incomplete reusable CSPICE cache for ${targetKey}; missing required path: ${requiredLib}`
        );
      }
    }

    if (!filesForTarget.has(REQUIRED_HEADER)) {
      throw new Error(
        `Incomplete reusable CSPICE cache for ${targetKey}; missing required path: ${REQUIRED_HEADER}`
      );
    }
  }

  console.log(`[raw-naif-guard] reusable CSPICE cache passed: ${cacheRoot}`);
}

function listTarEntries(tarballPath) {
  const result = spawnSync("tar", ["-tf", tarballPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to list tarball contents (tar -tf ${tarballPath}): ${result.stderr?.trim() || "unknown error"}`
    );
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findDisallowedTarEntries(entries) {
  const disallowed = [];

  for (const entry of entries) {
    const lower = entry.toLowerCase();

    if (/(^|\/)cspice.*\.tar(\.z|\.gz)?$/i.test(lower) || /(^|\/)naif.*\.tar(\.z|\.gz)?$/i.test(lower) || /(^|\/)(cspice|naif).*\.zip$/i.test(lower)) {
      disallowed.push(entry);
      continue;
    }

    if (/(^|\/)cspice\/(src|doc|exe|etc|data)(\/|$)/i.test(lower)) {
      disallowed.push(entry);
      continue;
    }
  }

  return disallowed;
}

function assertTarballHasNoRawNaifContent(tarballPath) {
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Tarball does not exist: ${tarballPath}`);
  }

  const entries = listTarEntries(tarballPath);
  const disallowed = findDisallowedTarEntries(entries);
  if (disallowed.length > 0) {
    throw new Error(
      `Tarball contains disallowed raw/unmodified NAIF content:\n` +
        disallowed.map((entry) => `- ${entry}`).join("\n")
    );
  }

  console.log(`[raw-naif-guard] tarball passed: ${tarballPath}`);
}

function npmPack(dir) {
  const result = spawnSync("npm", ["pack", "--silent"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `npm pack failed in ${dir} (exit ${result.status ?? "unknown"}):\n${result.stderr ?? ""}`
    );
  }

  const tarballName = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!tarballName) {
    throw new Error(`npm pack did not output a tarball name in ${dir}`);
  }

  return path.join(dir, tarballName);
}

function parseArgs(argv) {
  const checks = {
    cacheRoots: [],
    tarballs: [],
    packDirs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--check-cspice-cache") {
      const maybePath = argv[i + 1];
      if (maybePath && !maybePath.startsWith("--")) {
        checks.cacheRoots.push(maybePath);
        i += 1;
      } else {
        checks.cacheRoots.push(path.join(getRepoRoot(), ".cache", "cspice"));
      }
      continue;
    }

    if (arg === "--check-npm-tarball") {
      const tarballPath = argv[i + 1];
      if (!tarballPath || tarballPath.startsWith("--")) {
        throw new Error(`--check-npm-tarball requires a tarball path`);
      }
      checks.tarballs.push(tarballPath);
      i += 1;
      continue;
    }

    if (arg === "--check-npm-pack-dir") {
      const packDir = argv[i + 1];
      if (!packDir || packDir.startsWith("--")) {
        throw new Error(`--check-npm-pack-dir requires a directory path`);
      }
      checks.packDirs.push(packDir);
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        [
          "Usage:",
          "  node scripts/check-no-raw-naif-artifacts.mjs [options]",
          "",
          "Options:",
          "  --check-cspice-cache [path]    Validate reusable cache layout (default: .cache/cspice)",
          "  --check-npm-tarball <path>     Validate an existing npm tarball",
          "  --check-npm-pack-dir <dir>     Run npm pack in dir, validate output tarball, then delete it",
        ].join("\n") + "\n"
      );
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    checks.cacheRoots.length === 0 &&
    checks.tarballs.length === 0 &&
    checks.packDirs.length === 0
  ) {
    checks.cacheRoots.push(path.join(getRepoRoot(), ".cache", "cspice"));
  }

  return checks;
}

function main() {
  const checks = parseArgs(process.argv.slice(2));

  for (const cacheRoot of checks.cacheRoots) {
    assertDerivedOnlyCspiceCache(path.resolve(cacheRoot));
  }

  for (const tarball of checks.tarballs) {
    assertTarballHasNoRawNaifContent(path.resolve(tarball));
  }

  for (const packDir of checks.packDirs) {
    const absDir = path.resolve(packDir);
    const tarballPath = npmPack(absDir);
    try {
      assertTarballHasNoRawNaifContent(tarballPath);
    } finally {
      fs.rmSync(tarballPath, { force: true });
    }
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[raw-naif-guard] ${message}`);
  process.exitCode = 1;
}
