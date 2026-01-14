import fs from "node:fs";
import path from "node:path";
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

function validateCspiceDir(cspiceDir) {
  return (
    fs.existsSync(path.join(cspiceDir, "include", "SpiceUsr.h")) &&
    fs.existsSync(path.join(cspiceDir, "lib", "cspice.a")) &&
    fs.existsSync(path.join(cspiceDir, "lib", "csupport.a"))
  );
}

function main() {
  const repoRoot = getRepoRoot();
  const manifest = readManifest();

  const override = process.env.TSPICE_CSPICE_DIR;
  if (override) {
    const resolved = path.resolve(override);
    if (!validateCspiceDir(resolved)) {
      throw new Error(
        `TSPICE_CSPICE_DIR does not look like a CSPICE install (missing include/ and lib/): ${resolved}`
      );
    }

    process.stdout.write(resolved);
    return;
  }

  const cspiceDir = path.join(
    repoRoot,
    ".cache",
    "cspice",
    manifest.toolkitVersion,
    `${process.platform}-${process.arch}`,
    "cspice"
  );

  if (!validateCspiceDir(cspiceDir)) {
    if (process.platform === "linux" && process.arch === "arm64") {
      throw new Error(
        `CSPICE not found at ${cspiceDir}. On linux-arm64 you must set TSPICE_CSPICE_DIR to a prebuilt CSPICE install.`
      );
    }

    throw new Error(
      `CSPICE not found at ${cspiceDir}. Run: pnpm run fetch:cspice (or set TSPICE_CSPICE_DIR).`
    );
  }

  process.stdout.write(cspiceDir);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
