import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function isCI() {
  const v = process.env.CI;
  return v === "true" || v === "1";
}

function getRepoRoot(pkgRoot) {
  // packages/backend-verify -> repo root
  return path.resolve(pkgRoot, "..", "..");
}

function readManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw);
}

function validateCspiceDir(cspiceDir) {
  return (
    fs.existsSync(path.join(cspiceDir, "include", "SpiceUsr.h")) &&
    fs.existsSync(path.join(cspiceDir, "lib", "cspice.a")) &&
    fs.existsSync(path.join(cspiceDir, "lib", "csupport.a"))
  );
}

function resolveDefaultCspiceDir(repoRoot) {
  const manifest = readManifest(repoRoot);
  return path.join(
    repoRoot,
    ".cache",
    "cspice",
    manifest.toolkitVersion,
    `${process.platform}-${process.arch}`,
    "cspice",
  );
}

function exeExt() {
  return process.platform === "win32" ? ".exe" : "";
}

function getBinaryPath(pkgRoot) {
  return path.join(pkgRoot, "native", "build", `cspice-runner${exeExt()}`);
}

function getStatePath(pkgRoot) {
  return path.join(pkgRoot, "native", "build", "cspice-runner.state.json");
}

function writeState(pkgRoot, state) {
  const statePath = getStatePath(pkgRoot);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function isUpToDate(binaryPath, sources) {
  if (!fs.existsSync(binaryPath)) return false;
  const binStat = fs.statSync(binaryPath);
  for (const src of sources) {
    if (!fs.existsSync(src)) return false;
    const st = fs.statSync(src);
    if (st.mtimeMs > binStat.mtimeMs) return false;
  }
  return true;
}

function run(command, args, opts) {
  const r = spawnSync(command, args, { encoding: "utf8", ...opts });
  return r;
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(scriptDir, "..");
  const repoRoot = getRepoRoot(pkgRoot);

  const binaryPath = getBinaryPath(pkgRoot);
  const statePath = getStatePath(pkgRoot);
  const sourcePath = path.join(pkgRoot, "native", "src", "cspice_runner.c");

  if (process.platform === "win32") {
    writeState(pkgRoot, {
      available: false,
      reason: "cspice-runner build is not supported on win32",
      binaryPath,
    });
    return;
  }

  if (isUpToDate(binaryPath, [sourcePath])) {
    writeState(pkgRoot, { available: true, binaryPath, reused: true });
    return;
  }

  let cspiceDir = process.env.TSPICE_CSPICE_DIR
    ? path.resolve(process.env.TSPICE_CSPICE_DIR)
    : resolveDefaultCspiceDir(repoRoot);

  if (!validateCspiceDir(cspiceDir)) {
    if (process.platform === "linux" && process.arch === "arm64") {
      if (isCI()) {
        writeState(pkgRoot, {
          available: false,
          reason:
            "Automatic CSPICE fetch is not supported on linux-arm64 (set TSPICE_CSPICE_DIR to a prebuilt CSPICE install)",
          binaryPath,
          cspiceDir,
        });
        return;
      }

      throw new Error(
        "Automatic CSPICE fetch is not supported on linux-arm64. Set TSPICE_CSPICE_DIR to a prebuilt CSPICE install.",
      );
    }

    if (isCI()) {
      writeState(pkgRoot, {
        available: false,
        reason:
          "CSPICE not available in CI (set TSPICE_CSPICE_DIR or prefetch .cache/cspice)",
        binaryPath,
        cspiceDir,
      });
      return;
    }

    // Local dev: fetch CSPICE automatically.
    const fetch = run("pnpm", ["-w", "fetch:cspice"], { cwd: repoRoot, stdio: "inherit" });
    if (fetch.status !== 0) {
      throw new Error(
        `pnpm -w fetch:cspice failed (exit ${fetch.status}). Install 'uncompress' + 'tar' or set TSPICE_CSPICE_DIR to a CSPICE install.`,
      );
    }

    cspiceDir = resolveDefaultCspiceDir(repoRoot);
    if (!validateCspiceDir(cspiceDir)) {
      throw new Error(
        `CSPICE still not found after fetch at ${cspiceDir}. Try setting TSPICE_CSPICE_DIR.`,
      );
    }
  }

  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });

  const cc = process.env.CC || "cc";
  const args = [
    "-O2",
    "-std=c99",
    "-I",
    path.join(cspiceDir, "include"),
    "-o",
    binaryPath,
    sourcePath,
    path.join(cspiceDir, "lib", "cspice.a"),
    path.join(cspiceDir, "lib", "csupport.a"),
  ];

  if (process.platform === "linux") {
    args.push("-lm");
  }

  const build = run(cc, args, { cwd: pkgRoot, stdio: "inherit" });
  if (build.status !== 0) {
    throw new Error(
      `Failed to build cspice-runner (exit ${build.status}). Ensure a C compiler is installed (gcc/clang) and CSPICE is available (TSPICE_CSPICE_DIR or pnpm -w fetch:cspice).`,
    );
  }

  fs.chmodSync(binaryPath, 0o755);

  writeState(pkgRoot, { available: true, binaryPath, cspiceDir, rebuilt: true });
  // A tiny log to help when running tests locally.
  if (!isCI()) {
    console.error(`[backend-verify] built cspice-runner: ${binaryPath}`);
  }
}

try {
  main();
} catch (error) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(scriptDir, "..");

  const message = error instanceof Error ? (error.stack || error.message) : String(error);

  if (isCI()) {
    writeState(pkgRoot, {
      available: false,
      reason: "cspice-runner build failed in CI",
      error: message,
      binaryPath: getBinaryPath(pkgRoot),
    });

    console.error(`[backend-verify] cspice-runner build failed in CI; parity tests will be skipped.\n${message}`);
    process.exitCode = 0;
  } else {
    console.error(message);
    process.exitCode = 1;
  }
}
