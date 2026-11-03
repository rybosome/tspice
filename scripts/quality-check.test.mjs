import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runQualityCheck } from "./quality-check.mjs";
import { selectQualityFiles, trackedQualityFiles } from "./quality-files.mjs";

function fixture(t, files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "tspice-quality-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  execFileSync("git", ["add", "--all"], { cwd: root });
  return root;
}
const quiet = () => {};

test("file inventory includes hand-maintained code/config/docs and excludes generated/binary output", () => {
  const paths = [
    "src/example.ts",
    "src/types.d.ts",
    "scripts/check.mjs",
    "README.md",
    ".github/workflows/ci.yml",
    "data/input.json",
    "data/coverage-ledger.json",
    "docs/coverage-ledger.md",
    "data/coverage-ledger-policy.json",
    "packages/backend-wasm/emscripten/glue.js",
    "packages/tspice/src/kernels/naifKernelId.ts",
    "apps/docs/api/reference/page.md",
    "apps/docs/public/tspice.schema.json",
    "docs/cspice-function-inventory.md",
    "pnpm-lock.yaml",
    "packages/core/dist/index.js",
    "node_modules/tool/index.js",
    "kernels/sample.bsp",
    "src/domain.c",
  ];
  assert.deepEqual(selectQualityFiles(paths, "lint"), [
    "scripts/check.mjs",
    "src/example.ts",
    "src/types.d.ts",
  ]);
  assert.deepEqual(selectQualityFiles(paths, "format"), [
    ".github/workflows/ci.yml",
    "README.md",
    "data/coverage-ledger-policy.json",
    "data/input.json",
    "scripts/check.mjs",
    "src/example.ts",
    "src/types.d.ts",
  ]);
});

test("quality gates reject an empty tracked scope", async (t) => {
  const root = fixture(t, {
    "README.txt": "outside the supported format scope",
  });
  for (const kind of ["format", "lint"]) {
    await assert.rejects(
      runQualityCheck({ root, kind, log: quiet }),
      /refusing an empty quality gate/,
    );
  }
});

test("format check fails on a real violation and --write repairs only selected files", async (t) => {
  const generated = "packages/backend-wasm/emscripten/glue.js";
  const root = fixture(t, {
    "src/example.ts": "export const answer=42",
    [generated]: "generated=do not rewrite",
  });
  await assert.rejects(
    runQualityCheck({ root, kind: "format", log: quiet }),
    /Formatting differs/,
  );
  assert.equal(
    await runQualityCheck({ root, kind: "format", write: true, log: quiet }),
    1,
  );
  assert.equal(await runQualityCheck({ root, kind: "format", log: quiet }), 1);
  assert.equal(
    readFileSync(path.join(root, generated), "utf8"),
    "generated=do not rewrite",
  );
});

test("lint evaluates TypeScript and fails on an actual unused-variable defect", async (t) => {
  const root = fixture(t, {
    "src/example.ts": "export const answer: number = 42;\n",
  });
  assert.equal(await runQualityCheck({ root, kind: "lint", log: quiet }), 1);
  writeFileSync(
    path.join(root, "src/example.ts"),
    "const unused: number = 42;\n",
  );
  await assert.rejects(
    runQualityCheck({ root, kind: "lint", log: quiet }),
    /Lint found/,
  );
});

test("untracked scratch files are excluded until added to Git", (t) => {
  const root = fixture(t, { "src/example.ts": "export const answer = 42;\n" });
  writeFileSync(path.join(root, "scratch.ts"), "invalid scratch contents");
  assert.deepEqual(trackedQualityFiles(root, "lint"), ["src/example.ts"]);
});

test("lint retains public API JSDoc requirements", async (t) => {
  const file = "packages/example/src/index.ts";
  const root = fixture(t, {
    [file]: "export function answer() { return 42; }\n",
  });
  await assert.rejects(
    runQualityCheck({ root, kind: "lint", log: quiet }),
    /Lint found/,
  );
  writeFileSync(
    path.join(root, file),
    "/** Return the answer. */\nexport function answer() { return 42; }\n",
  );
  assert.equal(await runQualityCheck({ root, kind: "lint", log: quiet }), 1);
});

test("lint rejects unsafe explicit any in production and treats warnings as failures", async (t) => {
  const root = fixture(t, {
    "src/example.ts": "export const identity = (value: any) => value;\n",
  });
  await assert.rejects(
    runQualityCheck({ root, kind: "lint", log: quiet }),
    /Lint found/,
  );
  const warningRoot = fixture(t, {
    "src/example.js": "/* eslint no-unused-vars: warn */\nconst unused = 42;\n",
  });
  await assert.rejects(
    runQualityCheck({ root: warningRoot, kind: "lint", log: quiet }),
    /Lint found/,
  );
});

test("required root entrypoints retain real gates and their regressions", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(
    scripts["format:check"],
    "node scripts/quality-check.mjs format",
  );
  assert.equal(scripts.lint, "node scripts/quality-check.mjs lint");
  for (const command of ["check:js", "check:js:required"]) {
    assert.match(scripts[command], /pnpm run test:quality-gates/);
    assert.match(scripts[command], /pnpm run format:check/);
    assert.match(scripts[command], /pnpm run lint/);
  }
});
