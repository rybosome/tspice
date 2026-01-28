import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = process.argv[2];
if (!version) {
  throw new Error("Usage: node scripts/set-release-version.mjs <version>");
}

// Basic semver validation (allows pre-release and build metadata).
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version)) {
  throw new Error(`Invalid version: ${version} (expected semver like 1.2.3 or 1.2.3-rc.1)`);
}

const repoRoot = path.resolve(__dirname, "..");
const packagesRoot = path.join(repoRoot, "packages");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
}

function setVersion(pkgPath) {
  const pkg = readJson(pkgPath);
  pkg.version = version;
  writeJson(pkgPath, pkg);
}

setVersion(path.join(packagesRoot, "tspice", "package.json"));

for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!entry.name.startsWith("tspice-native-")) continue;
  setVersion(path.join(packagesRoot, entry.name, "package.json"));
}
