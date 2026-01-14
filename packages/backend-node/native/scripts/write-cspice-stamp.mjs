import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function escapeCStringLiteral(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t");
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
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
