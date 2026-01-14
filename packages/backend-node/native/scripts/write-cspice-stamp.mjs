import fs from "node:fs";
import path from "node:path";
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
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function buildStampValue({ toolkitVersion, cspiceDir }) {
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

  const safeStat = (libPath, label) => {
    try {
      return fs.statSync(libPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to stat ${label} at ${libPath}: ${message}`);
    }
  };

  const cspiceLibStat = safeStat(cspiceLibPath, "CSPICE library");
  const csupportLibStat = safeStat(csupportLibPath, "CSUPPORT library");

  return JSON.stringify({
    toolkitVersion,
    platform: process.platform,
    arch: process.arch,
    cspiceDir,
    libs: {
      cspice: { size: cspiceLibStat.size, mtimeMs: cspiceLibStat.mtimeMs },
      csupport: { size: csupportLibStat.size, mtimeMs: csupportLibStat.mtimeMs },
    },
  });
}

function writeIfChanged(filePath, content) {
  let existing = null;
  try {
    if (fs.existsSync(filePath)) {
      existing = fs.readFileSync(filePath, "utf8");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read existing generated file at ${filePath}: ${message}`);
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

function main() {
  const manifest = readManifest();
  const cspiceDir = getCspiceDir();

  const generatedDir = path.join(getNativeDir(), "generated");
  if (!path.isAbsolute(generatedDir)) {
    throw new Error(`Expected absolute generatedDir, got: ${generatedDir}`);
  }
  const headerPath = path.join(generatedDir, "cspice_stamp.h");

  const stampValue = buildStampValue({ toolkitVersion: manifest.toolkitVersion, cspiceDir });

  const header = [
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

try {
  main();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
}
