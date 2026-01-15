import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
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

function ensureTool(tool) {
  const result = spawnSync("sh", ["-c", `command -v ${shQuote(tool)}`], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
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
  const exact = `${platform}-${arch}`;
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

function validateCspiceSourceDir(cspiceDir) {
  const spiceUsr = path.join(cspiceDir, "include", "SpiceUsr.h");
  const srcDir = path.join(cspiceDir, "src");

  return fs.existsSync(spiceUsr) && fs.existsSync(srcDir);
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

async function main() {
  const mode = process.argv.includes("--source") ? "source" : "archive";

  const override = process.env.TSPICE_CSPICE_DIR;
  if (override && mode === "archive") {
    const resolved = path.resolve(override);
    if (!validateCspiceDir(resolved)) {
      throw new Error(
        `TSPICE_CSPICE_DIR does not look like a CSPICE install (missing include/ and lib/): ${resolved}`
      );
    }

    console.log(`CSPICE ready: ${resolved}`);
    return;
  }

  if (mode === "archive" && process.platform === "linux" && process.arch === "arm64") {
    throw new Error(
      "Automatic CSPICE fetch is not supported on linux-arm64. Set TSPICE_CSPICE_DIR to a prebuilt CSPICE install."
    );
  }

  // Note: we intentionally do not validate ELF/Mach-O arch or attempt to rebuild CSPICE here.
  // If the prebuilt archives are incompatible with the current host, provide a compatible install via TSPICE_CSPICE_DIR.

  const manifest = readManifest();
  const toolkitVersion = manifest.toolkitVersion;
  const repoRoot = getRepoRoot();

  if (mode === "source") {
    const source = manifest.source;
    if (!source || typeof source !== "object") {
      throw new Error(`No CSPICE source entry found in scripts/cspice.manifest.json`);
    }
    if (typeof source.url !== "string" || typeof source.sha256 !== "string") {
      throw new Error(`Invalid CSPICE source entry in scripts/cspice.manifest.json`);
    }

    const cacheDir = path.join(repoRoot, ".cache", "cspice", toolkitVersion, "source");
    const cspiceDir = await ensureCachedArchive({
      url: source.url,
      sha256: source.sha256,
      cacheDir,
      validateDir: validateCspiceSourceDir,
    });
    console.log(`CSPICE source ready: ${cspiceDir}`);
    return;
  }

  const archiveKey = resolveArchiveKey(manifest, process.platform, process.arch);
  const { url, sha256 } = manifest.archives[archiveKey];

  const cacheDir = path.join(
    repoRoot,
    ".cache",
    "cspice",
    toolkitVersion,
    `${process.platform}-${process.arch}`
  );

  console.log(`Ensuring CSPICE ${toolkitVersion} (${archiveKey})...`);
  const cspiceDir = await ensureCachedArchive({
    url,
    sha256,
    cacheDir,
    validateDir: validateCspiceDir,
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
