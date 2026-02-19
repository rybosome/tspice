import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const DERIVED_LIB_FILENAMES = ["cspice.a", "csupport.a"];

function getRepoRoot() {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptsDir, "..");
}

function normalizeTarget(platform, arch) {
  return `${platform}-${arch}`;
}

function readManifest() {
  const repoRoot = getRepoRoot();
  const manifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid manifest JSON at ${manifestPath}`);
  }
  if (typeof parsed.toolkitVersion !== "string" || parsed.toolkitVersion.trim() === "") {
    throw new Error(`Missing toolkitVersion in ${manifestPath}`);
  }

  return parsed;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`);
  }
  if (!response.body) {
    throw new Error(`No response body for download: ${url}`);
  }

  const tmpPath = `${filePath}.tmp-${crypto.randomUUID()}`;
  const fileStream = fs.createWriteStream(tmpPath);
  await pipeline(Readable.fromWeb(response.body), fileStream);

  fs.renameSync(tmpPath, filePath);
}

function shQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    const printable = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status}): ${printable}`);
  }
}

function ensureTool(tool, { missingMessage } = {}) {
  const result = spawnSync("sh", ["-c", `command -v ${shQuote(tool)}`], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      missingMessage ??
        `Required tool "${tool}" not found on PATH. Install it, or set TSPICE_CSPICE_DIR to a prebuilt CSPICE install.`
    );
  }
}

function extractTarZ(archivePath, outDir) {
  ensureTool("uncompress");
  ensureTool("tar");
  ensureDir(outDir);
  runChecked("sh", [
    "-c",
    `uncompress -c ${shQuote(archivePath)} | tar xf - -C ${shQuote(outDir)}`,
  ]);
}

function resolveArchiveKey(manifest, platform, arch) {
  const exact = normalizeTarget(platform, arch);
  if (manifest.archives?.[exact]) {
    return exact;
  }

  const available = Object.keys(manifest.archives ?? {}).sort();
  throw new Error(
    `No CSPICE archive configured for ${exact}. Available: ${available.join(", ")}`
  );
}

function validateCspiceDir(cspiceDir) {
  const spiceUsr = path.join(cspiceDir, "include", "SpiceUsr.h");
  const cspiceLib = path.join(cspiceDir, "lib", "cspice.a");
  const csupportLib = path.join(cspiceDir, "lib", "csupport.a");

  return fs.existsSync(spiceUsr) && fs.existsSync(cspiceLib) && fs.existsSync(csupportLib);
}

function validateDerivedOnlyCspiceDir(cspiceDir) {
  if (!validateCspiceDir(cspiceDir)) {
    return false;
  }

  const topLevelEntries = fs.readdirSync(cspiceDir, { withFileTypes: true });
  const allowedTopLevel = new Set(["include", "lib"]);
  for (const entry of topLevelEntries) {
    if (!allowedTopLevel.has(entry.name)) {
      return false;
    }
  }

  const libDir = path.join(cspiceDir, "lib");
  const libEntries = fs.readdirSync(libDir, { withFileTypes: true });
  const allowedLibs = new Set(DERIVED_LIB_FILENAMES);
  for (const entry of libEntries) {
    if (!entry.isFile() || !allowedLibs.has(entry.name)) {
      return false;
    }
  }

  return true;
}

function validateCspiceSourceDir(cspiceDir) {
  const spiceUsr = path.join(cspiceDir, "include", "SpiceUsr.h");
  const srcDir = path.join(cspiceDir, "src");

  return fs.existsSync(spiceUsr) && fs.existsSync(srcDir);
}

function stageDerivedArtifacts({ sourceCspiceDir, targetCacheRoot }) {
  if (!validateCspiceDir(sourceCspiceDir)) {
    throw new Error(`Source CSPICE directory is missing required artifacts: ${sourceCspiceDir}`);
  }

  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-cspice-stage-"));
  try {
    const stagedCspiceDir = path.join(stagingRoot, "cspice");
    const stagedIncludeDir = path.join(stagedCspiceDir, "include");
    const stagedLibDir = path.join(stagedCspiceDir, "lib");

    ensureDir(stagedCspiceDir);
    ensureDir(stagedLibDir);

    fs.cpSync(path.join(sourceCspiceDir, "include"), stagedIncludeDir, { recursive: true });

    for (const filename of DERIVED_LIB_FILENAMES) {
      fs.copyFileSync(
        path.join(sourceCspiceDir, "lib", filename),
        path.join(stagedLibDir, filename)
      );
    }

    if (!validateDerivedOnlyCspiceDir(stagedCspiceDir)) {
      throw new Error(
        `Failed to stage derived-only CSPICE artifacts (unexpected layout): ${stagedCspiceDir}`
      );
    }

    fs.rmSync(targetCacheRoot, { recursive: true, force: true });
    ensureDir(targetCacheRoot);

    const targetCspiceDir = path.join(targetCacheRoot, "cspice");
    fs.cpSync(stagedCspiceDir, targetCspiceDir, { recursive: true });

    if (!validateDerivedOnlyCspiceDir(targetCspiceDir)) {
      throw new Error(`Invalid derived CSPICE install after staging: ${targetCspiceDir}`);
    }

    return targetCspiceDir;
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

async function downloadAndVerifyArchive({ url, sha256, archivePath }) {
  ensureDir(path.dirname(archivePath));
  await downloadToFile(url, archivePath);

  const actual = await sha256File(archivePath);
  if (actual !== sha256) {
    fs.rmSync(archivePath, { force: true });
    throw new Error(`SHA256 mismatch. Expected ${sha256}, got ${actual}. URL: ${url}`);
  }
}

function assertPinnedDigestImage(imageRef) {
  if (!/^.+@sha256:[a-f0-9]{64}$/i.test(imageRef)) {
    throw new Error(
      `Toolchain image must be pinned by digest (expected name@sha256:...). Got: ${JSON.stringify(imageRef)}`
    );
  }
}

function getLinuxArm64SourceBuildConfig(manifest) {
  if (!manifest.source || typeof manifest.source !== "object") {
    throw new Error(`No CSPICE source entry found in scripts/cspice.manifest.json`);
  }
  if (typeof manifest.source.url !== "string" || typeof manifest.source.sha256 !== "string") {
    throw new Error(`Invalid CSPICE source entry in scripts/cspice.manifest.json`);
  }

  const sourceBuild = manifest.sourceBuild;
  if (!sourceBuild || typeof sourceBuild !== "object") {
    throw new Error(`Missing sourceBuild config in scripts/cspice.manifest.json`);
  }

  const buildScriptVersionRaw = sourceBuild.buildScriptVersion;
  const buildScriptVersion =
    typeof buildScriptVersionRaw === "string" && buildScriptVersionRaw.trim() !== ""
      ? buildScriptVersionRaw
      : null;
  if (!buildScriptVersion) {
    throw new Error(`Missing sourceBuild.buildScriptVersion in scripts/cspice.manifest.json`);
  }

  const toolchainImageRaw = sourceBuild.toolchainImage;
  if (typeof toolchainImageRaw !== "string" || toolchainImageRaw.trim() === "") {
    throw new Error(`Missing sourceBuild.toolchainImage in scripts/cspice.manifest.json`);
  }
  const toolchainImage = toolchainImageRaw.trim();
  assertPinnedDigestImage(toolchainImage);

  const targetEntry = sourceBuild.targets?.["linux-arm64"];
  if (!targetEntry || typeof targetEntry !== "object") {
    throw new Error(`Missing sourceBuild.targets["linux-arm64"] in scripts/cspice.manifest.json`);
  }

  const sourceUrl =
    typeof targetEntry.sourceUrl === "string" && targetEntry.sourceUrl.trim() !== ""
      ? targetEntry.sourceUrl
      : manifest.source.url;
  const sourceSha256 =
    typeof targetEntry.sourceSha256 === "string" && targetEntry.sourceSha256.trim() !== ""
      ? targetEntry.sourceSha256
      : manifest.source.sha256;

  if (typeof sourceUrl !== "string" || typeof sourceSha256 !== "string") {
    throw new Error(
      `Invalid linux-arm64 source metadata in scripts/cspice.manifest.json (expected sourceUrl/sourceSha256)`
    );
  }

  return {
    sourceUrl,
    sourceSha256,
    buildScriptVersion,
    toolchainImage,
  };
}

function ensureDockerAvailable() {
  const result = spawnSync("docker", ["version"], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(
      "linux-arm64 CSPICE source builds require Docker (for a pinned toolchain image). Install Docker or set TSPICE_CSPICE_DIR to a prebuilt CSPICE install."
    );
  }
}

function runLinuxArm64SourceBuildInDocker({ archivePath, toolchainImage, outputDir }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-cspice-docker-"));

  try {
    const inputDir = path.join(tempRoot, "input");
    ensureDir(inputDir);

    const archiveInInput = path.join(inputDir, "cspice.tar.Z");
    fs.copyFileSync(archivePath, archiveInInput);

    const buildScriptPath = path.join(inputDir, "build-cspice.sh");
    fs.writeFileSync(
      buildScriptPath,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "",
        "export DEBIAN_FRONTEND=noninteractive",
        "apt-get update",
        "apt-get install -y --no-install-recommends build-essential csh ncompress ca-certificates",
        "rm -rf /var/lib/apt/lists/*",
        "",
        "WORKDIR=$(mktemp -d)",
        "cleanup() {",
        "  rm -rf \"$WORKDIR\"",
        "}",
        "trap cleanup EXIT",
        "",
        "cp /input/cspice.tar.Z \"$WORKDIR/cspice.tar.Z\"",
        "cd \"$WORKDIR\"",
        "uncompress -c cspice.tar.Z | tar xf -",
        "cd cspice",
        "",
        "# NAIF build scripts use -m64; drop it for aarch64 builds.",
        "sed -i 's/-m64[[:space:]]*//g' src/cspice/mkprodct.csh src/csupport/mkprodct.csh",
        "",
        "(cd src/cspice && csh mkprodct.csh)",
        "(cd src/csupport && csh mkprodct.csh)",
        "",
        "test -f lib/cspice.a",
        "test -f lib/csupport.a",
        "",
        "mkdir -p /out/cspice/include /out/cspice/lib",
        "cp -a include/. /out/cspice/include/",
        "cp lib/cspice.a /out/cspice/lib/cspice.a",
        "cp lib/csupport.a /out/cspice/lib/csupport.a",
        "",
      ].join("\n"),
      "utf8"
    );
    fs.chmodSync(buildScriptPath, 0o755);

    ensureDir(outputDir);

    runChecked("docker", [
      "run",
      "--rm",
      "--platform",
      "linux/arm64",
      "-v",
      `${inputDir}:/input:ro`,
      "-v",
      `${outputDir}:/out`,
      toolchainImage,
      "bash",
      "/input/build-cspice.sh",
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function ensureCachedArchive({ url, sha256, cacheDir, validateDir }) {
  ensureDir(cacheDir);

  const archiveName = path.basename(new URL(url).pathname);
  const archivePath = path.join(cacheDir, archiveName);
  const cspiceDir = path.join(cacheDir, "cspice");

  if (fs.existsSync(archivePath)) {
    const actual = await sha256File(archivePath);
    if (actual !== sha256) {
      fs.rmSync(archivePath, { force: true });
      fs.rmSync(cspiceDir, { recursive: true, force: true });
    }
  }

  if (!fs.existsSync(archivePath)) {
    console.log(`Downloading ${archiveName}...`);
    await downloadToFile(url, archivePath);
    const actual = await sha256File(archivePath);
    if (actual !== sha256) {
      fs.rmSync(archivePath, { force: true });
      fs.rmSync(cspiceDir, { recursive: true, force: true });
      throw new Error(
        `SHA256 mismatch for ${archiveName}. Expected ${sha256}, got ${actual}. URL: ${url}`
      );
    }
  }

  if (!validateDir(cspiceDir)) {
    console.log(`Extracting ${archiveName}...`);

    const extractDir = fs.mkdtempSync(path.join(cacheDir, "extract-"));
    try {
      extractTarZ(archivePath, extractDir);
      const extractedCspice = path.join(extractDir, "cspice");
      if (!fs.existsSync(extractedCspice)) {
        throw new Error(`Archive did not contain expected cspice/ directory: ${archivePath}`);
      }

      fs.rmSync(cspiceDir, { recursive: true, force: true });
      fs.renameSync(extractedCspice, cspiceDir);
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }

  if (!validateDir(cspiceDir)) {
    throw new Error(`Invalid CSPICE install after extraction: ${cspiceDir}`);
  }

  return cspiceDir;
}

async function ensureDerivedFromArchive({ url, sha256, targetCacheRoot }) {
  const targetCspiceDir = path.join(targetCacheRoot, "cspice");
  if (validateDerivedOnlyCspiceDir(targetCspiceDir)) {
    return targetCspiceDir;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-cspice-archive-"));
  try {
    const archivePath = path.join(tempRoot, "cspice.tar.Z");
    console.log(`Downloading ${path.basename(new URL(url).pathname)}...`);
    await downloadAndVerifyArchive({ url, sha256, archivePath });

    const extractRoot = path.join(tempRoot, "extract");
    ensureDir(extractRoot);
    console.log(`Extracting ${path.basename(new URL(url).pathname)}...`);
    extractTarZ(archivePath, extractRoot);

    const extractedCspice = path.join(extractRoot, "cspice");
    if (!fs.existsSync(extractedCspice)) {
      throw new Error(`Archive did not contain expected cspice/ directory: ${archivePath}`);
    }

    return stageDerivedArtifacts({
      sourceCspiceDir: extractedCspice,
      targetCacheRoot,
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function ensureDerivedFromLinuxArm64SourceBuild({ manifest, targetCacheRoot }) {
  const targetCspiceDir = path.join(targetCacheRoot, "cspice");
  if (validateDerivedOnlyCspiceDir(targetCspiceDir)) {
    return targetCspiceDir;
  }

  ensureDockerAvailable();

  const { sourceUrl, sourceSha256, buildScriptVersion, toolchainImage } =
    getLinuxArm64SourceBuildConfig(manifest);

  console.log(`Building CSPICE from pinned source for linux-arm64 (build script v${buildScriptVersion})...`);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-cspice-sourcebuild-"));
  try {
    const archivePath = path.join(tempRoot, "cspice.tar.Z");
    await downloadAndVerifyArchive({
      url: sourceUrl,
      sha256: sourceSha256,
      archivePath,
    });

    const dockerOutDir = path.join(tempRoot, "docker-out");
    runLinuxArm64SourceBuildInDocker({
      archivePath,
      toolchainImage,
      outputDir: dockerOutDir,
    });

    const dockerBuiltCspice = path.join(dockerOutDir, "cspice");
    return stageDerivedArtifacts({
      sourceCspiceDir: dockerBuiltCspice,
      targetCacheRoot,
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const mode = process.argv.includes("--source") ? "source" : "archive";

  const manifest = readManifest();
  const repoRoot = getRepoRoot();
  const toolkitVersion = manifest.toolkitVersion;

  if (mode === "source") {
    const source = manifest.source;
    if (!source || typeof source !== "object") {
      throw new Error(`No CSPICE source entry found in scripts/cspice.manifest.json`);
    }
    if (typeof source.url !== "string" || typeof source.sha256 !== "string") {
      throw new Error(`Invalid CSPICE source entry in scripts/cspice.manifest.json`);
    }

    const sourceCacheDir = path.join(repoRoot, ".cache", "cspice-source", toolkitVersion, "source");
    const cspiceDir = await ensureCachedArchive({
      url: source.url,
      sha256: source.sha256,
      cacheDir: sourceCacheDir,
      validateDir: validateCspiceSourceDir,
    });
    console.log(`CSPICE source ready: ${cspiceDir}`);
    return;
  }

  const override = process.env.TSPICE_CSPICE_DIR;
  if (override) {
    const resolved = path.resolve(override);
    if (!validateCspiceDir(resolved)) {
      throw new Error(
        `TSPICE_CSPICE_DIR does not look like a CSPICE install (missing include/ and lib/): ${resolved}`
      );
    }

    console.log(`CSPICE ready: ${resolved}`);
    return;
  }

  const target = normalizeTarget(process.platform, process.arch);
  const cacheRoot = path.join(repoRoot, ".cache", "cspice", toolkitVersion, target);

  // Drop legacy source cache path that previously stored raw NAIF source under
  // .cache/cspice/<toolkit>/source.
  fs.rmSync(path.join(repoRoot, ".cache", "cspice", toolkitVersion, "source"), {
    recursive: true,
    force: true,
  });

  if (target === "linux-arm64") {
    const cspiceDir = await ensureDerivedFromLinuxArm64SourceBuild({
      manifest,
      targetCacheRoot: cacheRoot,
    });
    console.log(`CSPICE ready: ${cspiceDir}`);
    return;
  }

  const archiveKey = resolveArchiveKey(manifest, process.platform, process.arch);
  const archive = manifest.archives?.[archiveKey];
  if (!archive || typeof archive !== "object") {
    throw new Error(`Invalid archive entry for ${archiveKey} in scripts/cspice.manifest.json`);
  }
  if (typeof archive.url !== "string" || typeof archive.sha256 !== "string") {
    throw new Error(`Invalid archive entry for ${archiveKey} in scripts/cspice.manifest.json`);
  }

  console.log(`Ensuring CSPICE ${toolkitVersion} (${archiveKey})...`);
  const cspiceDir = await ensureDerivedFromArchive({
    url: archive.url,
    sha256: archive.sha256,
    targetCacheRoot: cacheRoot,
  });
  console.log(`CSPICE ready: ${cspiceDir}`);
}

(async () => {
  try {
    await main();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.stack || error.message);
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  }
})();
