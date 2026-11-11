#!/usr/bin/env node

import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const expectedPnpmVersion =
  packageJson.packageManager?.match(/^pnpm@(.+)$/)?.[1];
const cspiceManifest = JSON.parse(
  readFileSync(path.join(repoRoot, "scripts", "cspice.manifest.json"), "utf8"),
);
const profile = process.argv[2] ?? "js";
const validProfiles = new Set(["js", "native", "wasm"]);
const failures = [];

if (!validProfiles.has(profile)) {
  process.stderr.write(
    `Usage: node scripts/doctor.mjs [js|native|wasm] (got ${JSON.stringify(profile)})\n`,
  );
  process.exit(2);
}

function run(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    timeout: 10_000,
  });

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    error: result.error,
  };
}

function report(name, ok, detail) {
  const label = ok ? "OK" : "MISSING";
  process.stdout.write(`${label.padEnd(8)} ${name}: ${detail}\n`);
  if (!ok) failures.push(name);
}

function checkNode() {
  const [major, minor, patch] = process.versions.node.split(".").map(Number);
  const supported = major === 20 || major === 22;
  report(
    "Node.js",
    supported,
    `found ${major}.${minor}.${patch}; required CI majors are Node 20 or 22`,
  );
}

function checkPnpm() {
  const result = run("pnpm", ["--version"]);
  if (result.error || !result.ok) {
    report(
      "pnpm",
      false,
      `not available on PATH; enable the Corepack shim or install pnpm@${expectedPnpmVersion}. Root scripts invoke pnpm by name${result.error ? ` (${result.error.message})` : ""}`,
    );
    return;
  }

  const foundVersion = result.output.split(/\s+/)[0];
  report(
    "pnpm",
    foundVersion === expectedPnpmVersion,
    `found ${foundVersion}; repository pins ${expectedPnpmVersion}`,
  );
}

function checkUvAndPython() {
  const uv = run("uv", ["--version"]);
  if (uv.error || !uv.ok) {
    report(
      "uv",
      false,
      `not available on PATH; install uv to run the SpiceyPy parity sidecar${uv.error ? ` (${uv.error.message})` : ""}`,
    );
    return;
  }
  report("uv", true, uv.output.split(/\s+/).slice(0, 2).join(" "));

  const interpreters = run("uv", ["python", "list", "--only-installed"]);
  const hasCompatiblePython =
    interpreters.ok &&
    interpreters.output.split("\n").some((line) => {
      const match = line.match(/cpython-(\d+)\.(\d+)\./);
      return Boolean(match && Number(match[1]) === 3 && Number(match[2]) >= 11);
    });

  report(
    "Python for parity",
    hasCompatiblePython,
    hasCompatiblePython
      ? "uv has a CPython 3.11+ interpreter available"
      : interpreters.ok
        ? 'uv needs a CPython 3.11+ interpreter; run "uv python install 3.11"'
        : `could not inspect uv's installed interpreters: ${interpreters.error?.message ?? interpreters.output}`,
  );
}

function checkExecutable(name, args, guidance) {
  if (!isOnPath(name)) {
    report(name, false, guidance);
    return;
  }

  if (args.length === 0) {
    report(name, true, "available on PATH");
    return;
  }

  const result = run(name, args);
  if (result.error || !result.ok) {
    report(
      name,
      false,
      `${guidance}${result.error ? ` (${result.error.message})` : ""}`,
    );
    return;
  }
  const firstLine = result.output.split("\n")[0] || "available";
  report(name, true, firstLine);
}

function isOnPath(name) {
  const extensions =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const extension of extensions) {
      try {
        accessSync(path.join(directory, `${name}${extension}`), constants.X_OK);
        return true;
      } catch {
        // Keep checking the remaining PATH entries.
      }
    }
  }
  return false;
}

function isReadable(filePath) {
  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function checkArchiveTools(required) {
  const optionalDetail =
    "not needed because the pinned CSPICE source/install is already available";
  if (!required && !isOnPath("tar")) report("tar", true, optionalDetail);
  else
    checkExecutable(
      "tar",
      ["--version"],
      "Install tar to extract the pinned CSPICE archive",
    );

  if (!required && !isOnPath("uncompress"))
    report("uncompress", true, optionalDetail);
  else {
    checkExecutable(
      "uncompress",
      [],
      "Install ncompress to extract the pinned CSPICE archive",
    );
  }
}

function checkNative() {
  checkExecutable("cc", ["--version"], "Install a C compiler");
  checkExecutable("c++", ["--version"], "Install a C++ compiler");
  checkExecutable("make", [], "Install make (required by node-gyp)");

  const override = process.env.TSPICE_CSPICE_DIR;
  const cachedCspice = path.join(
    repoRoot,
    ".cache",
    "cspice",
    cspiceManifest.toolkitVersion,
    `${process.platform}-${process.arch}`,
    "cspice",
  );
  const cspiceDir = override ? path.resolve(override) : cachedCspice;
  const hasCspice = [
    path.join(cspiceDir, "include", "SpiceUsr.h"),
    path.join(cspiceDir, "lib", "cspice.a"),
    path.join(cspiceDir, "lib", "csupport.a"),
  ].every(isReadable);
  const automaticFetchSupported = Boolean(
    cspiceManifest.archives?.[`${process.platform}-${process.arch}`],
  );
  if (override && !hasCspice) {
    report(
      "CSPICE",
      false,
      `TSPICE_CSPICE_DIR is invalid: ${cspiceDir}; expected include/SpiceUsr.h, lib/cspice.a, and lib/csupport.a`,
    );
    return;
  }
  if (hasCspice || automaticFetchSupported) {
    checkArchiveTools(!hasCspice);
  }
  report(
    "CSPICE",
    hasCspice || automaticFetchSupported,
    hasCspice
      ? `found at ${cspiceDir}`
      : automaticFetchSupported
        ? "not cached; `pnpm run check:native:required` fetches the pinned archive, or set TSPICE_CSPICE_DIR"
        : `automatic fetch is unavailable on ${process.platform}-${process.arch}; set TSPICE_CSPICE_DIR to a compatible CSPICE install`,
  );
}

function checkWasm() {
  const sourceDir = path.join(
    repoRoot,
    ".cache",
    "cspice",
    cspiceManifest.toolkitVersion,
    "source",
    "cspice",
  );
  const hasSource =
    isReadable(path.join(sourceDir, "src")) &&
    isReadable(path.join(sourceDir, "include", "SpiceUsr.h"));
  checkArchiveTools(!hasSource);
  checkExecutable(
    "emcc",
    ["--version"],
    "Install and activate the Emscripten SDK to regenerate the checked-in WASM artifacts",
  );
}

checkNode();
if (profile !== "wasm") {
  checkPnpm();
  checkUvAndPython();
}

if (profile === "native") checkNative();
if (profile === "wasm") checkWasm();

if (failures.length > 0) {
  process.stderr.write(
    `\n${failures.length} prerequisite check(s) need attention. See docs/development-setup.md.\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `\nPrerequisites for the ${profile} profile are available.\n`,
  );
}
