import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getRepoRoot() {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptsDir, "..");
}

function readManifest() {
  const repoRoot = getRepoRoot();
  const manifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid manifest JSON at ${manifestPath}`);
  }

  return parsed;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing ${label} in scripts/cspice.manifest.json`);
  }
  return value.trim();
}

function extractSha256Digest(imageRef) {
  const match = imageRef.match(/@sha256:(?<digest>[a-f0-9]{64})$/i);
  if (!match?.groups?.digest) {
    throw new Error(
      `sourceBuild.toolchainImage must be pinned by digest (expected name@sha256:...). Got: ${JSON.stringify(imageRef)}`
    );
  }
  return match.groups.digest.toLowerCase();
}

function parseTarget(argv) {
  const idx = argv.indexOf("--target");
  if (idx === -1) {
    return `${process.platform}-${process.arch}`;
  }

  const raw = argv[idx + 1];
  if (!raw || raw.startsWith("--")) {
    throw new Error(`--target requires a value (expected <platform>-<arch>)`);
  }

  return raw;
}

function main() {
  const argv = process.argv.slice(2);
  const githubEnv = argv.includes("--github-env");
  const target = parseTarget(argv);

  const manifest = readManifest();
  const sourceSha256 = requireNonEmptyString(manifest.source?.sha256, "source.sha256");
  const buildScriptVersion = requireNonEmptyString(
    manifest.sourceBuild?.buildScriptVersion,
    "sourceBuild.buildScriptVersion"
  );
  const toolchainImage = requireNonEmptyString(
    manifest.sourceBuild?.toolchainImage,
    "sourceBuild.toolchainImage"
  );
  const toolchainDigest = extractSha256Digest(toolchainImage);

  const identity = {
    sourceSha256,
    toolchainDigest,
    target,
    buildScriptVersion,
  };

  if (githubEnv) {
    process.stdout.write(`CSPICE_CACHE_SOURCE_SHA256=${identity.sourceSha256}\n`);
    process.stdout.write(`CSPICE_CACHE_TOOLCHAIN_DIGEST=${identity.toolchainDigest}\n`);
    process.stdout.write(`CSPICE_CACHE_TARGET=${identity.target}\n`);
    process.stdout.write(`CSPICE_CACHE_BUILD_SCRIPT_VERSION=${identity.buildScriptVersion}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
