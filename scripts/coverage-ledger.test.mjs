import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildLedger, generate } from "./generate-coverage-ledger.mjs";
import {
  cTokens,
  cFunctions,
  cCalls,
} from "./coverage-ledger/source-analysis.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const inputs = [
  "package.json",
  "turbo.json",
  ".github/workflows/ci.yml",
  "data/cspice-functions.json",
  "data/coverage-ledger-policy.json",
  "scripts/build-backend-wasm.mjs",
  "packages/backend-contract/src",
  "packages/backend-node/src",
  "packages/backend-node/native/src",
  "packages/backend-node/native/binding.gyp",
  "packages/backend-wasm/src",
  "packages/backend-wasm/emscripten/tspice_backend_wasm.wasm",
  "packages/backend-shim-c/src",
  "packages/backend-shim-c/include",
  "packages/core/src",
  "packages/py-parity-checking/src/cases",
  "packages/py-parity-checking/src/run-tspice",
  "packages/py-parity-checking/package.json",
];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ledger-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of inputs) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repoRoot, relative), target, { recursive: true });
  }
  fs.mkdirSync(path.join(root, "docs"));
  function edit(relative, before, after) {
    const file = path.join(root, relative);
    const text = fs.readFileSync(file, "utf8");
    assert.ok(text.includes(before), `Fixture mutation not found: ${before}`);
    fs.writeFileSync(file, text.replace(before, after));
  }
  return { root, edit, build: () => buildLedger(root, { trackedFiles }) };
}

test("baseline derives breadth and preserves fallback/non-direct evidence", (t) => {
  const f = fixture(t);
  const ledger = f.build();
  assert.deepEqual(ledger.summary, {
    total: 652,
    eligible: 649,
    implemented: 162,
    planned: 487,
    excluded: 3,
    caseFiles: 162,
    scenarios: 305,
    wasmRawUnsupported: 1,
  });
  const kplfrm = ledger.routines.find((r) => r.routine === "kplfrm_c");
  assert.equal(kplfrm.inventoryDecision, "planned");
  assert.equal(kplfrm.implementation, "contract-present");
  assert.equal(kplfrm.backends.wasm.status, "unsupported");
  assert.equal(
    kplfrm.backends.wasm.oracleParity.classification,
    "harness-fallback-not-raw-parity",
  );
  assert.equal(
    ledger.routines.find((r) => r.routine === "kxtrct_c").backends.wasm.status,
    "javascript-implementation",
  );
  assert.equal(
    ledger.routines.find((r) => r.routine === "bodfnd_c").mapping.node
      .classification,
    "alias-or-composed",
  );
  const dskAlias = ledger.operationRoutes.find(
    (route) => route.operation === "dsk.dascls",
  );
  assert.equal(dskAlias.contractDomain, "file-io");
  assert.equal(
    dskAlias.namespaceMapping,
    "dispatcher-alias-with-direct-raw-call",
  );
});

test("unregistered scenario files fail instead of being counted by filename", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    path.join(
      f.root,
      "packages/py-parity-checking/src/cases/time/orphan.cases.json",
    ),
    "[]\n",
  );
  assert.throws(f.build, /Unregistered case file/);
});

test("removing an allCases spread fails registration drift", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/py-parity-checking/src/cases/index.ts",
    "  ...timeCases,",
    "",
  );
  assert.throws(f.build, /Unregistered case file/);
});

test("dynamic registry expressions fail rather than silently undercounting", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/py-parity-checking/src/cases/index.ts",
    "  ...timeCases,",
    "  ...timeCases.concat([]),",
  );
  assert.throws(f.build, /Unsupported case-registry expression/);
});

test("scenario operations must reference a raw method and their owning routine", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/py-parity-checking/src/cases/time/str2et.cases.json",
    '"op": "time.str2et"',
    '"op": "time.notAContractMethod"',
  );
  assert.throws(f.build, /Scenario operation has no raw contract method/);
});

test("operation namespaces must be registered dispatcher routes", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/py-parity-checking/src/cases/time/str2et.cases.json",
    '"op": "time.str2et"',
    '"op": "wrong-domain.str2et"',
  );
  assert.throws(f.build, /Scenario operation has no raw contract method/);
});

test("a contract method with no scenarios fails", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    path.join(
      f.root,
      "packages/py-parity-checking/src/cases/time/str2et.cases.json",
    ),
    "[]\n",
  );
  assert.throws(f.build, /Raw contract method has no registered cases: str2et/);
});

test("a constant Node stub does not count as a native route", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-node/src/domains/time.ts",
    "return native.str2et(time);",
    "return 0;",
  );
  assert.throws(f.build, /No traced Node native\/shared-shim route for str2et/);
});

test("removing raw factory composition fails despite dormant domain code", (t) => {
  const f = fixture(t);
  f.edit("packages/backend-node/src/index.ts", "      ...timeApi,", "");
  assert.throws(
    f.build,
    /Factory not wired into node raw backend: createTimeApi/,
  );
});

test("removing native addon registration fails despite existing export bodies", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-node/native/src/addon.cc",
    "  if (!registerDomain(tspice_backend_node::RegisterTime)) return exports;",
    "",
  );
  assert.throws(f.build, /Native registration is not wired into addon/);
});

test("removing a shared shim definition fails", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-shim-c/src/domains/time.c",
    "int tspice_str2et(",
    "int tspice_str2et_removed(",
  );
  assert.throws(
    f.build,
    /Missing shared shim declaration\/definition: tspice_str2et/,
  );
});

test("removing a configured WASM export fails", (t) => {
  const f = fixture(t);
  f.edit(
    "scripts/build-backend-wasm.mjs",
    '"_tspice_str2et",',
    '"_tspice_str2et_removed",',
  );
  assert.throws(f.build, /WASM route missing configured export: str2et/);
});

test("a shim implementation outside the production build does not count", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-node/native/binding.gyp",
    '        "../../backend-shim-c/src/domains/time.c",',
    "",
  );
  assert.throws(f.build, /Node shared shim source not compiled/);
});

test("cached toolkit results must still be sourced from CSPICE at backend creation", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-wasm/src/runtime/create-backend.node.ts",
    "const toolkitVersion = getToolkitVersion(module);",
    'const toolkitVersion = "fake";',
  );
  assert.throws(f.build, /Cached toolkit-version binding drift/);
});

test("the checked-in binary export is checked independently of source/config", (t) => {
  const f = fixture(t);
  const file = path.join(
    f.root,
    "packages/backend-wasm/emscripten/tspice_backend_wasm.wasm",
  );
  const bytes = fs.readFileSync(file);
  const offset = bytes.indexOf(Buffer.from("tspice_str2et"));
  assert.ok(offset >= 0);
  bytes.write("tspice_str2ez", offset);
  fs.writeFileSync(file, bytes);
  assert.throws(f.build, /WASM route missing checked-in binary export: str2et/);
});

test("stale unsupported-method exceptions fail", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-wasm/src/domains/kernels.ts",
    "kplfrm not supported in current WASM bundle",
    "different implementation",
  );
  assert.throws(f.build, /Stale WASM exception for kplfrm/);
});

test("an inert error string cannot stand in for an unsupported throw", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/backend-wasm/src/domains/kernels.ts",
    'throw new Error("kplfrm not supported in current WASM bundle");',
    '"kplfrm not supported in current WASM bundle"; return [];',
  );
  assert.throws(f.build, /Stale WASM exception for kplfrm/);
});

test("an existing but disconnected harness fallback does not count", (t) => {
  const f = fixture(t);
  f.edit(
    "packages/py-parity-checking/src/run-tspice/domains/kernels.ts",
    "return runWasmKplfrmFallback(context, frmcls);",
    "return [];",
  );
  assert.throws(f.build, /Stale harness fallback dispatch for kplfrm/);
});

test("non-direct mappings require an explicit evidence-backed policy", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "data/coverage-ledger-policy.json");
  const policy = JSON.parse(fs.readFileSync(file, "utf8"));
  delete policy.mappingNotes.bodfnd;
  fs.writeFileSync(file, JSON.stringify(policy));
  assert.throws(f.build, /Unexplained non-direct node mapping for bodfnd/);
});

test("CI native expectation forwarding is distinct from exporting it in the shell", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "turbo.json");
  const turbo = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["globalEnv", "globalPassThroughEnv"])
    turbo[key] = (turbo[key] ?? []).filter(
      (name) => name !== "TSPICE_EXPECT_NATIVE",
    );
  for (const key of ["env", "passThroughEnv"])
    turbo.tasks.test[key] = (turbo.tasks.test[key] ?? []).filter(
      (name) => name !== "TSPICE_EXPECT_NATIVE",
    );
  fs.writeFileSync(file, JSON.stringify(turbo));
  const before = f
    .build()
    .ciLanes.find((lane) => lane.backends.includes("node"));
  assert.equal(before.nativeExpectationConfigured, true);
  assert.equal(before.nativeExpectationForwardedByTurbo, false);
  turbo.tasks.test.env = ["TSPICE_EXPECT_NATIVE"];
  fs.writeFileSync(file, JSON.stringify(turbo));
  assert.equal(
    f.build().ciLanes.find((lane) => lane.backends.includes("node"))
      .nativeExpectationForwardedByTurbo,
    true,
  );
});

test("a missing native CI lane fails configuration coverage", (t) => {
  const f = fixture(t);
  f.edit(
    ".github/workflows/ci.yml",
    "pnpm run check:native:required",
    "pnpm run unrelated",
  );
  assert.throws(f.build, /Missing configured Node or WASM parity CI lane/);
});

test("canonical inventory schema rejects invalid decisions, names, purposes and duplicates", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "data/cspice-functions.json");
  const inventory = JSON.parse(fs.readFileSync(file, "utf8"));
  const original = JSON.stringify(inventory);
  for (const mutation of [
    (entries) => {
      entries.find((entry) => entry.name === "ftncls_c").decision = "typo";
    },
    (entries) => {
      entries[0].name = 123;
    },
    (entries) => {
      entries[0].purpose = "";
    },
    (entries) => {
      entries.push({ ...entries[0] });
    },
  ]) {
    const entries = JSON.parse(original);
    mutation(entries);
    fs.writeFileSync(file, JSON.stringify(entries));
    assert.throws(
      f.build,
      /Invalid canonical inventory entry|Duplicate canonical routine name/,
    );
  }
});

test("CI lanes reject no-op, parity-excluding and unknown Turbo test commands", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(file, "utf8"));
  const original = JSON.stringify(packageJson);
  for (const script of ["test:required", "test:js:required"]) {
    for (const command of [
      "echo skipped",
      "turbo run test --filter=!@rybosome/tspice-py-parity-checking",
      "turbo run test --filter=@rybosome/tspice-backend-node",
      "turbo run test -- --testNamePattern=unrelated",
    ]) {
      const mutated = JSON.parse(original);
      mutated.scripts[script] = command;
      fs.writeFileSync(file, JSON.stringify(mutated));
      assert.throws(f.build, /unproven Turbo parity test scope/);
    }
  }
});

test("CI lanes reject no-op and filtered parity package test scripts", (t) => {
  const f = fixture(t);
  const file = path.join(f.root, "packages/py-parity-checking/package.json");
  const packageJson = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const command of [
    "echo skipped",
    "vitest run test/smoke.test.ts",
    "vitest run --exclude '**/parity*'",
  ]) {
    packageJson.scripts.test = command;
    fs.writeFileSync(file, JSON.stringify(packageJson));
    assert.throws(f.build, /must invoke the full Vitest suite/);
  }
});

test("check mode rejects stale committed output", (t) => {
  const f = fixture(t);
  generate(f.root, false, { trackedFiles });
  assert.doesNotThrow(() => generate(f.root, true, { trackedFiles }));
  fs.appendFileSync(path.join(f.root, "data/coverage-ledger.json"), "\n");
  assert.throws(
    () => generate(f.root, true, { trackedFiles }),
    /Stale coverage ledger/,
  );
});

test("C token analysis ignores comment/literal fake calls and literal braces", () => {
  const functions = cFunctions(
    cTokens(
      '/* int fake() { bogus_c(); } */\nint real() { const char *s = "}"; prefix "("; actual_c(); /* fake_c(); */ }',
    ),
  );
  assert.deepEqual([...functions.keys()], ["real"]);
  assert.deepEqual(cCalls(functions.get("real").body), ["actual_c"]);
});
