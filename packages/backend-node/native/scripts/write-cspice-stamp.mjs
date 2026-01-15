import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

function escapeCStringLiteral(value) {
  let result = "";
  for (const ch of value) {
    switch (ch) {
      case "\\":
        result += "\\\\";
        break;
      case '"':
        result += '\\"';
        break;
      case "\n":
        result += "\\n";
        break;
      case "\r":
        result += "\\r";
        break;
      case "\t":
        result += "\\t";
        break;
      default: {
        const code = ch.codePointAt(0);
        if (code !== undefined && code >= 0x20 && code <= 0x7e) {
          result += ch;
          break;
        }

        const bytes = Buffer.from(ch, "utf8");
        for (const b of bytes) {
          result += `\\x${b.toString(16).padStart(2, "0")}`;
        }
      }
    }
  }
  return result;
}

function getNativeDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function getRepoRoot() {
  return path.resolve(getNativeDir(), "..", "..", "..");
}

function getManifestPath() {
  const override = process.env.TSPICE_CSPICE_MANIFEST;
  if (override && override.trim() !== "") {
    return override;
  }
  return path.join(getRepoRoot(), "scripts", "cspice.manifest.json");
}

function readManifest() {
  const manifestPath = getManifestPath();
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read CSPICE manifest at ${manifestPath}: ${message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse CSPICE manifest JSON at ${manifestPath}: ${message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid manifest JSON at ${manifestPath}`);
  }
  if (typeof parsed.toolkitVersion !== "string") {
    throw new Error(`Missing toolkitVersion in ${manifestPath}`);
  }
  return parsed;
}

function getCspiceDir() {
  const argv = process.argv.slice(2);
  if (argv.length !== 1) {
    throw new Error(
      `Expected exactly one argument: CSPICE dir (got ${argv.length}). ` +
        `Invoked as: node scripts/write-cspice-stamp.mjs <cspiceDir>; args: ${JSON.stringify(
          argv
        )}`
    );
  }

  const dir = argv[0].trim();
  if (!dir) {
    throw new Error("CSPICE dir argument was empty.");
  }

  const resolved = path.resolve(dir);
  let finalDir = resolved;
  try {
    finalDir = fs.realpathSync(resolved);
  } catch {
    // Preserve the resolved path for diagnostics.
  }

  let stat;
  try {
    stat = fs.statSync(finalDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CSPICE dir does not exist or is not readable: ${finalDir}: ${message}`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`CSPICE dir is not a directory: ${finalDir}`);
  }

  return finalDir;
}

async function sha256File(filePath, label) {
  const hash = crypto.createHash("sha256");
  try {
    await pipeline(fs.createReadStream(filePath), hash);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to hash ${label} at ${filePath}: ${message}`);
  }
  return hash.digest("hex");
}

async function safeStat(filePath, label) {
  try {
    return await fs.promises.stat(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to stat ${label} at ${filePath}: ${message}`);
  }
}

async function buildStampValue({ toolkitVersion, cspiceDir }) {
  if (typeof toolkitVersion !== "string" || toolkitVersion.trim() === "") {
    throw new Error(
      `Invalid toolkitVersion: expected non-empty string, got ${JSON.stringify(toolkitVersion)}`
    );
  }

  if (typeof cspiceDir !== "string" || cspiceDir.trim() === "") {
    throw new Error(`Invalid cspiceDir: expected non-empty string, got ${JSON.stringify(cspiceDir)}`);
  }

  const cspiceLibPath = path.join(cspiceDir, "lib", "cspice.a");
  const csupportLibPath = path.join(cspiceDir, "lib", "csupport.a");

  const [cspiceLibStat, csupportLibStat] = await Promise.all([
    safeStat(cspiceLibPath, "CSPICE library"),
    safeStat(csupportLibPath, "CSUPPORT library"),
  ]);

  const [cspiceSha256, csupportSha256] = await Promise.all([
    sha256File(cspiceLibPath, "CSPICE library"),
    sha256File(csupportLibPath, "CSUPPORT library"),
  ]);

  return JSON.stringify({
    toolkitVersion,
    platform: process.platform,
    arch: process.arch,
    cspiceDir,
    libs: {
      cspice: { size: cspiceLibStat.size, sha256: cspiceSha256 },
      csupport: { size: csupportLibStat.size, sha256: csupportSha256 },
    },
  });
}

function writeIfChanged(filePath, content) {
  let existing = null;
  try {
    existing = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      existing = null;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read existing generated file at ${filePath}: ${message}`);
    }
  }

  if (existing === content) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write generated file at ${filePath}: ${message}`);
  }
}

async function main() {
  const manifest = readManifest();
  const cspiceDir = getCspiceDir();

  const generatedDir = path.join(getNativeDir(), "generated");
  if (!path.isAbsolute(generatedDir)) {
    throw new Error(`Expected absolute generatedDir, got: ${generatedDir}`);
  }
  const headerPath = path.join(generatedDir, "cspice_stamp.h");

  const stampValue = await buildStampValue({
    toolkitVersion: manifest.toolkitVersion,
    cspiceDir,
  });

  const header = [
    "// Generated by write-cspice-stamp.mjs. Used to force rebuilds when CSPICE changes.",
    "#pragma once",
    "",
    `#define TSPICE_CSPICE_STAMP \"${escapeCStringLiteral(stampValue)}\"`,
    "",
  ].join("\n");

  writeIfChanged(headerPath, header);

  // Print the absolute generated directory path for consumption by binding.gyp via
  // the tspice_native_generated_dir variable.
  process.stdout.write(generatedDir);
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
