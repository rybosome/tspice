import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const packagesRoot = path.join(repoRoot, "packages");

const tspicePkgPath = path.join(packagesRoot, "tspice", "package.json");
const tspicePkg = JSON.parse(fs.readFileSync(tspicePkgPath, "utf8"));
const expectedVersion = tspicePkg.version;

const nativeDirs = fs
  .readdirSync(packagesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("tspice-native-"))
  .map((d) => d.name)
  .sort();

if (!nativeDirs.length) {
  throw new Error(`No tspice-native-* packages found under ${packagesRoot}`);
}

const mismatches = [];
for (const dir of nativeDirs) {
  const pkgPath = path.join(packagesRoot, dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.version !== expectedVersion) {
    mismatches.push(`${pkg.name ?? dir}: ${pkg.version} (expected ${expectedVersion})`);
  }
}

if (mismatches.length) {
  throw new Error(
    [
      `Native package versions must match @rybosome/tspice (${expectedVersion}).`,
      ...mismatches.map((m) => `- ${m}`),
    ].join("\n"),
  );
}
