import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const doctor = path.join(repoRoot, "scripts", "doctor.mjs");
const pnpmVersion = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
).packageManager.slice("pnpm@".length);

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "tspice-doctor-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  mkdirSync(bin);

  function tool(name, body) {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }

  function jsTools() {
    tool("pnpm", `echo '${pnpmVersion}'`);
    tool("uv", 'if [ "$1" = "--version" ]; then echo "uv test"; else echo "cpython-3.11.0-test /test/python"; fi');
  }

  function run(profile = "js", extraEnv = {}) {
    const result = spawnSync(process.execPath, [doctor, profile], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: bin, TSPICE_CSPICE_DIR: "", ...extraEnv },
      timeout: 15_000,
    });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  }

  return { root, tool, jsTools, run };
}

test("JS profile accepts the pinned pnpm and an installed compatible Python", (t) => {
  const f = fixture(t);
  f.jsTools();
  assert.equal(f.run().status, 0);
});

test("JS profile rejects a mismatched pnpm version", (t) => {
  const f = fixture(t);
  f.jsTools();
  f.tool("pnpm", 'echo "0.0.0"');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /repository pins/);
});

test("JS profile explains when the pnpm shim is missing from PATH", (t) => {
  const f = fixture(t);
  f.jsTools();
  rmSync(path.join(f.root, "bin", "pnpm"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /Root scripts invoke pnpm by name/);
});

test("JS profile reports interpreter discovery errors instead of suggesting an install", (t) => {
  const f = fixture(t);
  f.jsTools();
  f.tool("uv", 'if [ "$1" = "--version" ]; then echo "uv test"; else echo "cache permission denied" >&2; exit 2; fi');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /cache permission denied/);
  assert.doesNotMatch(result.output, /uv python install/);
});

test("JS profile explains how to install a missing compatible Python", (t) => {
  const f = fixture(t);
  f.jsTools();
  f.tool("uv", 'if [ "$1" = "--version" ]; then echo "uv test"; else echo "cpython-3.9.0-test /test/python"; fi');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /uv python install 3\.11/);
});

test("native profile rejects an invalid explicit CSPICE override", (t) => {
  const f = fixture(t);
  f.jsTools();
  for (const name of ["cc", "c++", "make"]) f.tool(name, 'echo "tool test"');
  const result = f.run("native", { TSPICE_CSPICE_DIR: path.join(f.root, "missing") });
  assert.equal(result.status, 1);
  assert.match(result.output, /TSPICE_CSPICE_DIR is invalid/);
});

test("native profile accepts a local CSPICE install without archive utilities", (t) => {
  const f = fixture(t);
  f.jsTools();
  for (const name of ["cc", "c++", "make"]) f.tool(name, 'echo "tool test"');
  const cspice = path.join(f.root, "cspice");
  for (const file of ["include/SpiceUsr.h", "lib/cspice.a", "lib/csupport.a"]) {
    const target = path.join(cspice, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "");
  }
  const result = f.run("native", { TSPICE_CSPICE_DIR: cspice });
  assert.equal(result.status, 0, result.output);
});

test("WASM profile works without pnpm, uv, or Python", (t) => {
  const f = fixture(t);
  for (const name of ["tar", "uncompress", "emcc"]) f.tool(name, 'echo "tool test"');
  assert.equal(f.run("wasm").status, 0);
});

test("WASM profile fails with actionable guidance when Emscripten is missing", (t) => {
  const f = fixture(t);
  for (const name of ["tar", "uncompress"]) f.tool(name, 'echo "tool test"');
  const result = f.run("wasm");
  assert.equal(result.status, 1);
  assert.match(result.output, /Install and activate the Emscripten SDK/);
});

test("unknown profiles report usage and exit with status 2", (t) => {
  const f = fixture(t);
  const result = f.run("unknown");
  assert.equal(result.status, 2);
  assert.match(result.output, /Usage:/);
});
