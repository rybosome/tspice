import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
const prepare = path.join(repoRoot, "scripts/prepare-package.mjs");
const parityScripts = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "packages/py-parity-checking/package.json"),
  ),
).scripts;
const packageManager = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json")),
).packageManager;

async function run(root, args, env = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      turbo,
      [...args, "--cache=local:rw", "--output-logs=full"],
      {
        cwd: root,
        env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1", ...env },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(output));
    }, 30_000);
    child.on("error", reject);
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, output });
    });
  });
}

function fixture(t, unsafe) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-orchestration-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write(
    "package.json",
    JSON.stringify({ private: true, packageManager, type: "module" }),
  );
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  write(
    "pnpm-lock.yaml",
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/producer: {}\n  packages/consumer: {}\n",
  );
  write("turbo.json", fs.readFileSync(path.join(repoRoot, "turbo.json")));
  write("scripts/prepare-package.mjs", fs.readFileSync(prepare));
  write(
    ".gitignore",
    "dist/\n.cache/\n.turbo/\nnode_modules/\narmed\nreader-*\ntruncated\npretest-done\nsidecar-ready\n",
  );
  fs.symlinkSync(
    path.join(repoRoot, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  // Explicit barriers hold a second artifact writer at its truncate/open phase.
  // This makes the missing-export failure deterministic instead of relying on
  // the duration of a real compiler write or cache extraction.
  write(
    "barrier.mjs",
    `
    import fs from 'node:fs';
    import {setTimeout} from 'node:timers/promises';
    export const root = new URL('./', import.meta.url);
    export const exists = name => fs.existsSync(new URL(name, root));
    export const mark = name => fs.writeFileSync(new URL(name, root), '');
    export async function until(predicate) {
      const deadline = Date.now() + 15000;
      while (!predicate()) {
        if (Date.now() > deadline) throw new Error('Barrier timeout');
        await setTimeout(10);
      }
    }
  `,
  );
  write(
    "packages/producer/package.json",
    JSON.stringify({
      name: "@fixture/producer",
      type: "module",
      exports: "./dist/index.js",
      scripts: {
        build: "node build.mjs",
        pretest: JSON.parse(
          fs.readFileSync(
            path.join(repoRoot, "packages/backend-node/package.json"),
          ),
        ).scripts.pretest,
        test: "node test.mjs",
        typecheck: "node typecheck.mjs",
      },
    }),
  );
  write(
    "packages/producer/build.mjs",
    `
    import fs from 'node:fs';
    import {exists, mark, until} from '../../barrier.mjs';
    fs.mkdirSync('dist', {recursive:true});
    if (exists('armed')) {
      await until(() => exists('reader-ready'));
      fs.writeFileSync('dist/index.js', '');
      mark('truncated');
      await until(() => exists('reader-observed'));
    }
    fs.writeFileSync('dist/index.js', 'export function createNodeBackend() { return 42; }');
  `,
  );
  write(
    "packages/producer/typecheck.mjs",
    `
    import fs from 'node:fs';
    if (!fs.existsSync('dist/index.js')) throw new Error('build not scheduled');
    fs.mkdirSync('.cache', {recursive:true});
    fs.writeFileSync('.cache/typecheck.tsbuildinfo', 'checked');
  `,
  );
  write(
    "packages/producer/test.mjs",
    `
    import {exists, mark, until} from '../../barrier.mjs';
    mark('reader-ready');
    await until(() => exists('truncated') || exists('pretest-done'));
    const {createNodeBackend} = await import('@fixture/producer');
    mark('reader-observed');
    if (createNodeBackend() !== 42) throw new Error('Wrong export');
  `,
  );
  write(
    "packages/consumer/package.json",
    JSON.stringify({
      name: "@fixture/consumer",
      private: true,
      type: "module",
      dependencies: { "@fixture/producer": "workspace:*" },
      scripts: {
        build: "node -e ''",
        pretest: `${unsafe ? `pnpm -w exec turbo run build --filter=@fixture/consumer --force` : parityScripts.pretest} && node -e "require('fs').writeFileSync('../../pretest-done','')"`,
        "setup:sidecar":
          "node -e \"require('fs').writeFileSync('../../sidecar-ready','')\"",
        test: "node -e \"if (!require('fs').existsSync('../../sidecar-ready')) throw Error('sidecar not prepared')\"",
      },
    }),
  );
  return { root, write };
}

test(
  "nested preparation reproduces a missing export while a sibling imports dist",
  { timeout: 60_000 },
  async (t) => {
    const f = fixture(t, true);
    const built = await run(f.root, ["run", "build"]);
    assert.equal(built.status, 0, built.output);
    f.write("armed", "");
    const result = await run(f.root, ["run", "test"]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /createNodeBackend is not a function/);
    assert.ok(fs.existsSync(path.join(f.root, "truncated")));
  },
);

test(
  "graph-owned preparation protects imports with cold and restored build caches",
  { timeout: 90_000 },
  async (t) => {
    const f = fixture(t, false);
    // Cold graph: every dependency build precedes its readers.
    const cold = await run(f.root, ["run", "test"]);
    assert.equal(cold.status, 0, cold.output);
    for (const marker of ["pretest-done", "reader-ready", "reader-observed"])
      fs.rmSync(path.join(f.root, marker));
    fs.rmSync(path.join(f.root, "packages/producer/dist"), { recursive: true });
    f.write("armed", "");
    // Force tests to execute, but allow dependency builds to restore their cache.
    // Any nested build would hit the synchronized destructive writer above.
    const warm = await run(f.root, ["run", "test"], {
      TSPICE_EXPECT_NATIVE: "true",
    });
    assert.equal(warm.status, 0, warm.output);
    assert.match(warm.output, /cache hit/);
    assert.ok(!fs.existsSync(path.join(f.root, "truncated")));
    const checked = await run(f.root, ["run", "typecheck"]);
    assert.equal(checked.status, 0, checked.output);
    assert.match(
      fs.readFileSync(
        path.join(f.root, "packages/producer/dist/index.js"),
        "utf8",
      ),
      /createNodeBackend/,
    );
  },
);

test(
  "direct package hooks prepare missing artifacts through the same build graph",
  { timeout: 60_000 },
  async (t) => {
    const f = fixture(t, false);
    const result = spawnSync(process.execPath, [prepare], {
      cwd: path.join(f.root, "packages/consumer"),
      encoding: "utf8",
      env: { ...process.env, TURBO_HASH: "" },
      timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(
      fs.existsSync(path.join(f.root, "packages/producer/dist/index.js")),
    );
  },
);

test(
  "warm TypeScript build caches leave newly compiled native artifacts untouched",
  { timeout: 60_000 },
  async (t) => {
    const f = fixture(t, false);
    f.write(
      ".gitignore",
      "dist/\n.cache/\n.turbo/\nnode_modules\npackages/*/native/build/\narmed\nreader-*\ntruncated\npretest-done\nsidecar-ready\n",
    );
    // Turbo's real-repository input discovery excludes ignored native artifacts.
    // An actual HEAD is required: the fallback for non-Git fixtures hashes more
    // files and can hide this stale-output restore by causing a build cache miss.
    for (const args of [
      ["init"],
      [
        "add",
        ".gitignore",
        "package.json",
        "pnpm-workspace.yaml",
        "pnpm-lock.yaml",
        "turbo.json",
        "scripts",
        "barrier.mjs",
        "packages",
      ],
      [
        "-c",
        "user.name=Orchestration Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fixture",
      ],
    ]) {
      const result = spawnSync("git", args, { cwd: f.root, encoding: "utf8" });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    const artifact = "packages/producer/native/build/Release/production.node";
    f.write(artifact, "old-native-build");
    const cold = await run(f.root, ["run", "build"]);
    assert.equal(cold.status, 0, cold.output);
    // Model the native compilation/staging that check:native:required performs
    // before asking Turbo for JS builds. A cached JS build must not undo it.
    f.write(artifact, "new-native-build");
    const warm = await run(f.root, ["run", "build"]);
    assert.equal(warm.status, 0, warm.output);
    assert.match(warm.output, /cache hit/);
    assert.equal(
      fs.readFileSync(path.join(f.root, artifact), "utf8"),
      "new-native-build",
    );
  },
);
