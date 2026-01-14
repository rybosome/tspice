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
        if (code !== undefined && (code < 0x20 || code > 0x7e)) {
          if (code <= 0xffff) {
            result += `\\u${code.toString(16).padStart(4, "0")}`;
          } else {
            result += `\\U${code.toString(16).padStart(8, "0")}`;
          }
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
  const scriptPath = path.join(getRepoRoot(), "scripts", "print-cspice-dir.mjs");
  const result = spawnSync(
    process.execPath,
    [scriptPath],
    { encoding: "utf8" }
  );

  if (result.error) {
    throw new Error(
      `Failed to execute print-cspice-dir script at ${scriptPath}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || "<no output>").trim();
    throw new Error(
      `print-cspice-dir script exited with code ${result.status} at ${scriptPath}: ${output}`
    );
  }

  const dir = result.stdout.trim();
  if (!dir) {
    throw new Error(`print-cspice-dir script at ${scriptPath} returned an empty directory path`);
  }

  return dir;
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
