import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

function getExpectedLibArchToken(platform, arch) {
  if (platform === "linux" && arch === "x64") {
    return "x86-64";
  }
  if (platform === "linux" && arch === "arm64") {
    return "aarch64";
  }
  if (platform === "darwin" && arch === "x64") {
    return "x86_64";
  }
  if (platform === "darwin" && arch === "arm64") {
    return "arm64";
  }
  return undefined;
}

function detectLibArchToken(libPath, objectName) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ar-"));
  try {
    runChecked("ar", ["x", libPath, objectName], { cwd: tmpDir, stdio: "pipe" });
    const objPath = path.join(tmpDir, objectName);
    const result = spawnSync("file", [objPath], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`file failed for ${objPath}: ${result.stderr ?? ""}`);
    }
    return result.stdout;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function patchLinuxArm64Mkprodct(scriptPath) {
  let content = fs.readFileSync(scriptPath, "utf8");
  if (!/\s+-m64\b/.test(content)) {
    console.warn(`mkprodct.csh at ${scriptPath} did not contain -m64; skipping patch.`);
    return;
  }

  const patched = content.replace(/\s+-m64\b/g, "");
  if (patched !== content) {
    console.log(`Patching -m64 from ${scriptPath} for linux-arm64 CSPICE rebuild.`);
    fs.writeFileSync(scriptPath, patched);
  }
}

function rebuildCspiceIfNeeded(cspiceDir) {
  ensureTool("ar");
  ensureTool("file");

  const libPath = path.join(cspiceDir, "lib", "cspice.a");
  const expectedToken = getExpectedLibArchToken(process.platform, process.arch);
  if (!expectedToken) {
    return;
  }

  const archInfo = detectLibArchToken(libPath, "tkvrsn_c.o");
  if (archInfo.includes(expectedToken)) {
    return;
  }

  if (process.platform === "linux" && process.arch === "arm64") {
    patchLinuxArm64Mkprodct(path.join(cspiceDir, "src", "cspice", "mkprodct.csh"));
    patchLinuxArm64Mkprodct(path.join(cspiceDir, "src", "csupport", "mkprodct.csh"));
  }

  const csh = spawnSync("sh", ["-c", "command -v csh"], { encoding: "utf8" });
  if (csh.status !== 0) {
    throw new Error(
      `CSPICE rebuild required (host=${process.platform}-${process.arch}), but \
"csh" is not installed. Install tcsh/csh (must provide /bin/csh), or set TSPICE_CSPICE_DIR to a prebuilt CSPICE install.`
    );
  }

  const srcCspiceDir = path.join(cspiceDir, "src", "cspice");
  const srcCsupportDir = path.join(cspiceDir, "src", "csupport");

  console.log(
    `Rebuilding CSPICE libs for ${process.platform}-${process.arch} (found incompatible archive).`
  );

  runChecked("sh", ["-c", "chmod u+x mkprodct.csh && ./mkprodct.csh"], { cwd: srcCspiceDir });
  runChecked("sh", ["-c", "chmod u+x mkprodct.csh && ./mkprodct.csh"], { cwd: srcCsupportDir });

  const updatedArchInfo = detectLibArchToken(libPath, "tkvrsn_c.o");
  if (!updatedArchInfo.includes(expectedToken)) {
    throw new Error(
      `CSPICE rebuild did not produce a compatible library for ${process.platform}-${process.arch}. Got: ${updatedArchInfo.trim()}`
    );
  }
}

function validateCspiceDir(cspiceDir) {
  const spiceUsr = path.join(cspiceDir, "include", "SpiceUsr.h");
  const cspiceLib = path.join(cspiceDir, "lib", "cspice.a");
  const csupportLib = path.join(cspiceDir, "lib", "csupport.a");

  return fs.existsSync(spiceUsr) && fs.existsSync(cspiceLib) && fs.existsSync(csupportLib);
}

async function main() {
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

  if (process.platform === "linux" && process.arch === "arm64") {
    throw new Error(
      "Automatic CSPICE fetch is not supported on linux-arm64. Set TSPICE_CSPICE_DIR to a prebuilt CSPICE install."
    );
  }

  const manifest = readManifest();
  const archiveKey = resolveArchiveKey(manifest, process.platform, process.arch);
  const { url, sha256 } = manifest.archives[archiveKey];
  const toolkitVersion = manifest.toolkitVersion;

  const repoRoot = getRepoRoot();
  const cacheDir = path.join(
    repoRoot,
    ".cache",
    "cspice",
    toolkitVersion,
    `${process.platform}-${process.arch}`
  );
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
    console.log(`Downloading CSPICE ${toolkitVersion} (${archiveKey})...`);
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

  if (!validateCspiceDir(cspiceDir)) {
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

  rebuildCspiceIfNeeded(cspiceDir);

  if (!validateCspiceDir(cspiceDir)) {
    throw new Error(`Invalid CSPICE install after extraction: ${cspiceDir}`);
  }

  console.log(`CSPICE ready: ${cspiceDir}`);
}

await main();
