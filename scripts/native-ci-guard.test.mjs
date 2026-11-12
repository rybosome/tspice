import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const parityRoot = path.join(repoRoot, "packages", "py-parity-checking");
const turbo = path.join(repoRoot, "node_modules", ".bin", "turbo");
const vitest = path.join(parityRoot, "node_modules", "vitest", "vitest.mjs");
const packageManager = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
).packageManager;

function quote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

test(
  "strict Turbo forwards and hashes the native requirement for the real sanity assertion",
  { timeout: 120_000 },
  (t) => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tspice-native-ci-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const fixturePackage = path.join(root, "packages", "py-parity-checking");
    const reportPath = path.join(fixturePackage, "result.json");
    mkdirSync(path.join(fixturePackage, "test", "_helpers"), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, packageManager }),
    );
    writeFileSync(
      path.join(root, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
    );
    writeFileSync(
      path.join(root, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/py-parity-checking: {}\n",
    );
    // Use the repository's actual task configuration and sanity assertion. These
    // are copied, so no real addon is hidden or removed during the negative check.
    writeFileSync(
      path.join(root, "turbo.json"),
      readFileSync(path.join(repoRoot, "turbo.json")),
    );
    for (const relative of [
      "native-required.test.ts",
      "_helpers/nodeBackendAvailable.ts",
    ]) {
      writeFileSync(
        path.join(fixturePackage, "test", relative),
        readFileSync(path.join(parityRoot, "test", relative)),
      );
    }
    symlinkSync(
      path.join(parityRoot, "node_modules"),
      path.join(fixturePackage, "node_modules"),
      "dir",
    );
    writeFileSync(
      path.join(fixturePackage, "package.json"),
      JSON.stringify({
        name: "@tspice-fixtures/native-ci-guard",
        private: true,
        type: "module",
        scripts: {
          test: `${quote(process.execPath)} ${quote(vitest)} run test/native-required.test.ts --reporter=json --outputFile=result.json --maxWorkers=1 --minWorkers=1`,
        },
      }),
    );

    writeFileSync(
      path.join(root, ".gitignore"),
      "node_modules\ndist\n.turbo\nresult.json\npackages/*/native/build/\n",
    );
    // Use real Git input discovery so ignored artifacts and reporter files
    // cannot accidentally cause cache misses that hide a stale required pass.
    for (const args of [
      ["init"],
      ["add", "."],
      [
        "-c",
        "user.name=Native Guard Fixture",
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
      const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }

    function run(required) {
      rmSync(reportPath, { force: true });
      const result = spawnSync(
        turbo,
        ["run", "test", "--env-mode=strict", "--cache=local:rw"],
        {
          cwd: root,
          env: {
            ...process.env,
            TSPICE_EXPECT_NATIVE: String(required),
            TURBO_TELEMETRY_DISABLED: "1",
          },
          encoding: "utf8",
          timeout: 30_000,
        },
      );
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      const report = (() => {
        try {
          return JSON.parse(readFileSync(reportPath, "utf8"));
        } catch (error) {
          assert.fail(
            `Vitest did not write its report: ${error.message}\n${output}`,
          );
        }
      })();
      return { status: result.status, report, output };
    }

    const optional = run(false);
    assert.equal(optional.status, 0, optional.output);
    assert.equal(optional.report.numPendingTests, 1);

    // Do not force a cache miss: changing only the env value must prevent reuse
    // of the preceding successful, optional-native test result.
    const missing = run(true);
    assert.equal(missing.status, 1, missing.output);
    assert.equal(missing.report.numFailedTests, 1);
    assert.equal(missing.report.numPendingTests, 0);

    const backendRoot = path.join(root, "packages", "backend-node");
    mkdirSync(path.join(backendRoot, "dist"), { recursive: true });
    mkdirSync(path.join(backendRoot, "native", "build", "Release"), {
      recursive: true,
    });
    writeFileSync(path.join(backendRoot, "dist", "index.js"), "");
    writeFileSync(
      path.join(
        backendRoot,
        "native",
        "build",
        "Release",
        "tspice_backend_node_test.node",
      ),
      "",
    );
    const testAddonOnly = run(true);
    assert.equal(testAddonOnly.status, 1, testAddonOnly.output);
    assert.equal(testAddonOnly.report.numFailedTests, 1);

    // These marker files exercise artifact detection only. Native CI separately
    // builds and loads the actual addon and compares both backends with SpiceyPy.
    writeFileSync(
      path.join(
        backendRoot,
        "native",
        "build",
        "Release",
        "tspice_backend_node.node",
      ),
      "",
    );
    const present = run(true);
    assert.equal(present.status, 0, present.output);
    assert.equal(present.report.numPassedTests, 1);
    assert.equal(present.report.numPendingTests, 0);

    const productionPath = path.join(
      backendRoot,
      "native/build/Release/tspice_backend_node.node",
    );
    writeFileSync(productionPath, "rebuilt production artifact");
    const rebuilt = run(true);
    assert.equal(rebuilt.status, 0, rebuilt.output);
    assert.equal(rebuilt.report.numPassedTests, 1);
    assert.match(rebuilt.output, /cache miss/);

    rmSync(productionPath);
    const removedAfterPass = run(true);
    assert.equal(removedAfterPass.status, 1, removedAfterPass.output);
    assert.equal(removedAfterPass.report.numFailedTests, 1);
    assert.equal(removedAfterPass.report.numPendingTests, 0);
  },
);
