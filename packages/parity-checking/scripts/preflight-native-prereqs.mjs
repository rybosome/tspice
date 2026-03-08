import fs from "node:fs";
import path from "node:path";

const REQUIRED_CSPICE_LAYOUT = [
  { relativePath: "include", kind: "dir" },
  { relativePath: "include/SpiceUsr.h", kind: "file" },
  { relativePath: "lib", kind: "dir" },
  { relativePath: "lib/cspice.a", kind: "file" },
  { relativePath: "lib/csupport.a", kind: "file" },
];

function fileExistsAsKind(absolutePath, kind) {
  try {
    const stat = fs.statSync(absolutePath);
    return kind === "dir" ? stat.isDirectory() : stat.isFile();
  } catch {
    return false;
  }
}

function findExecutableOnPath(binaryName) {
  const pathValue = process.env.PATH;
  if (!pathValue) return null;

  for (const segment of pathValue.split(path.delimiter)) {
    if (!segment) continue;
    const candidate = path.join(segment, binaryName);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // continue scanning PATH
    }
  }

  return null;
}

function printFailure(messages) {
  console.error("[parity-checking] native preflight failed.");
  for (const message of messages) {
    console.error(`- ${message}`);
  }

  console.error("\nRemediation:");
  console.error("1) Ensure `nix` is installed and available on PATH (https://nixos.org/download/).");
  console.error("2) Build or obtain a linux-arm64 CSPICE install (Nix bootstrap or equivalent path).");
  console.error("3) Export `TSPICE_CSPICE_DIR` to that CSPICE root.");
  console.error("4) Confirm the directory contains:");
  for (const entry of REQUIRED_CSPICE_LAYOUT) {
    console.error(`   - ${entry.relativePath}${entry.kind === "dir" ? "/" : ""}`);
  }
  console.error("5) Re-run: pnpm run preflight:parity:native");
}

function main() {
  const failures = [];

  if (!(process.platform === "linux" && process.arch === "arm64")) {
    console.log(
      `[parity-checking] native preflight is scoped to linux-arm64 devboxes. Current host is ${process.platform}/${process.arch}.`,
    );
    return;
  }

  const nixExecutable = findExecutableOnPath("nix");
  if (!nixExecutable) {
    failures.push("`nix` is not available on PATH.");
  }

  const cspiceDirRaw = process.env.TSPICE_CSPICE_DIR;
  if (!cspiceDirRaw || cspiceDirRaw.trim() === "") {
    failures.push("`TSPICE_CSPICE_DIR` is not set.");
  }

  let resolvedCspiceDir = "";
  if (cspiceDirRaw && cspiceDirRaw.trim() !== "") {
    resolvedCspiceDir = path.resolve(cspiceDirRaw);
    if (!fileExistsAsKind(resolvedCspiceDir, "dir")) {
      failures.push(`TSPICE_CSPICE_DIR does not resolve to a directory: ${resolvedCspiceDir}`);
    } else {
      const missingEntries = REQUIRED_CSPICE_LAYOUT.filter((entry) => {
        const targetPath = path.join(resolvedCspiceDir, entry.relativePath);
        return !fileExistsAsKind(targetPath, entry.kind);
      }).map((entry) => entry.relativePath);

      if (missingEntries.length > 0) {
        failures.push(
          `CSPICE directory is missing required paths: ${missingEntries.join(", ")} (root: ${resolvedCspiceDir})`,
        );
      }
    }
  }

  if (failures.length > 0) {
    printFailure(failures);
    process.exitCode = 1;
    return;
  }

  console.log("[parity-checking] native preflight passed.");
  console.log(`- host: ${process.platform}/${process.arch}`);
  console.log(`- nix: ${nixExecutable}`);
  console.log(`- TSPICE_CSPICE_DIR: ${resolvedCspiceDir}`);
  console.log("- verified CSPICE layout: include/SpiceUsr.h, lib/cspice.a, lib/csupport.a");
}

main();
