import { spawnSync } from "node:child_process";
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
        if (code !== undefined && code < 0x20) {
          result += `\\x${code.toString(16).padStart(2, "0")}`;
        } else {
          result += ch;
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

function readManifest() {
  const manifestPath = path.join(getRepoRoot(), "scripts", "cspice.manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid manifest JSON at ${manifestPath}`);
  }
  if (typeof parsed.toolkitVersion !== "string") {
    throw new Error(`Missing toolkitVersion in ${manifestPath}`);
  }
  return parsed;
}

function getCspiceDir() {
  const result = spawnSync(
    process.execPath,
    [path.join(getRepoRoot(), "scripts", "print-cspice-dir.mjs")],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Failed to resolve CSPICE dir").trim());
  }

  return result.stdout.trim();
}

function buildStampValue({ toolkitVersion, cspiceDir }) {
  const cspiceLibPath = path.join(cspiceDir, "lib", "cspice.a");
  const csupportLibPath = path.join(cspiceDir, "lib", "csupport.a");

  if (!fs.existsSync(cspiceLibPath)) {
    throw new Error(`Expected CSPICE library at ${cspiceLibPath}, but it was not found.`);
  }

  if (!fs.existsSync(csupportLibPath)) {
    throw new Error(`Expected CSUPPORT library at ${csupportLibPath}, but it was not found.`);
  }

  const cspiceLibStat = fs.statSync(cspiceLibPath);
  const csupportLibStat = fs.statSync(csupportLibPath);

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
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (existing === content) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main() {
  const manifest = readManifest();
  const cspiceDir = getCspiceDir();

  const generatedDir = path.join(getNativeDir(), "generated");
  const headerPath = path.join(generatedDir, "cspice_stamp.h");

  const stampValue = buildStampValue({ toolkitVersion: manifest.toolkitVersion, cspiceDir });

  const header = [
    "#pragma once",
    "",
    `#define TSPICE_CSPICE_STAMP \"${escapeCStringLiteral(stampValue)}\"`,
    "",
  ].join("\n");

  writeIfChanged(headerPath, header);

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
