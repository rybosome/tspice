import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { auditSourceDigest } from "./coverage-ledger/audits.mjs";
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
  "data/parity-audits",
  "packages/py-parity-checking/fixtures/kernels/kplfrm-minimal.tf",
  "packages/py-parity-checking/src/case-types.ts",
  "packages/py-parity-checking/test/parity.test.ts",
  "packages/py-parity-checking/src/parity-assert.ts",
  "packages/py-parity-checking/src/run-tspice/index.ts",
  "packages/py-parity-checking/src/run-tspice/context.ts",
  "packages/py-parity-checking/sidecars/spiceypy/src",
  "packages/py-parity-checking/sidecars/spiceypy/uv.lock",
  "packages/py-parity-checking/src/run-sidecar.ts",
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
  // Synthetic mutations exercise validation independently of real, source-bound
  // execution observations. Preserve the human review but reset verification.
  for (const file of fs.readdirSync(path.join(root, "data/parity-audits"))) {
    if (file === "baseline.json") continue;
    if (file !== "vectors-arithmetic.json") {
      fs.rmSync(path.join(root, "data/parity-audits", file));
      continue;
    }
    const target = path.join(root, "data/parity-audits", file);
    const record = JSON.parse(fs.readFileSync(target, "utf8"));
    record.executions = [];
    for (const review of record.routines)
      for (const judgment of Object.values(review.backends)) {
        judgment.executions = [];
        if (judgment.history.at(-1) === "verified")
          judgment.history = ["unreviewed", "reviewed"];
      }
    fs.writeFileSync(target, JSON.stringify(record));
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

test("baseline derives breadth and preserves direct/non-direct evidence", (t) => {
  const f = fixture(t);
  const ledger = f.build();
  assert.deepEqual(ledger.summary, {
    total: 652,
    eligible: 649,
    implemented: 184,
    planned: 465,
    excluded: 3,
    caseFiles: 184,
    scenarios: 1236,
    wasmRawUnsupported: 0,
  });
  const kplfrm = ledger.routines.find((r) => r.routine === "kplfrm_c");
  assert.equal(kplfrm.inventoryDecision, "planned");
  assert.equal(kplfrm.implementation, "contract-present");
  assert.equal(kplfrm.backends.wasm.status, "source-and-binary-route-present");
  assert.ok(kplfrm.backends.wasm.shimSymbols.includes("tspice_kplfrm"));
  assert.equal(
    ledger.routines.find((r) => r.routine === "kxtrct_c").backends.wasm.status,
    "javascript-implementation",
  );
  assert.equal(
    ledger.routines.find((r) => r.routine === "bodfnd_c").mapping.node
      .classification,
    "same-named-cspice-entrypoint",
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
  const f = unsupportedFixture(t);
  f.edit(
    "packages/backend-wasm/src/domains/kernels.ts",
    "kplfrm not supported in current WASM bundle",
    "different implementation",
  );
  assert.throws(f.build, /Stale WASM exception for kplfrm/);
});

test("an inert error string cannot stand in for an unsupported throw", (t) => {
  const f = unsupportedFixture(t);
  f.edit(
    "packages/backend-wasm/src/domains/kernels.ts",
    'throw new Error("kplfrm not supported in current WASM bundle");',
    '"kplfrm not supported in current WASM bundle"; return [];',
  );
  assert.throws(f.build, /Stale WASM exception for kplfrm/);
});

test("an existing but disconnected harness fallback does not count", (t) => {
  const f = unsupportedFixture(t);
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
  delete policy.mappingNotes.bodvar;
  fs.writeFileSync(file, JSON.stringify(policy));
  assert.throws(f.build, /Unexplained non-direct node mapping for bodvar/);
});

test("the ray mapping requires the real SURFPT symbol and scoped public trace", (t) => {
  const f = fixture(t);
  const file = "packages/backend-shim-c/src/domains/geometry.c";
  for (const [before, after] of [
    ["surfpt_((doublereal *)position", "unrelated_((doublereal *)position"],
    ['chkin_c("surfpt_c");', 'unused_entry("surfpt_c");'],
    ['chkout_c("surfpt_c");', 'unused_exit("surfpt_c");'],
  ]) {
    f.edit(file, before, after);
    assert.throws(f.build, /Stale non-direct mapping policy for node.surfpt/);
    f.edit(file, after, before);
  }
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

function editAudit(f, mutate, file = "vectors-arithmetic.json") {
  const target = path.join(f.root, "data/parity-audits", file);
  const record = JSON.parse(fs.readFileSync(target, "utf8"));
  mutate(record);
  fs.writeFileSync(target, JSON.stringify(record));
}

test("maintained audit separates reviewed findings from verified backend execution", (t) => {
  const ledger = fixture(t).build();
  assert.equal(ledger.audit.baselineRoutines, 162);
  assert.equal(ledger.audit.expansionRoutines, 22);
  for (const name of [
    "nearpt",
    "npedln",
    "edlimb",
    "ednmpt",
    "edpnt",
    "surfnm",
    "surfpt",
  ]) {
    const routine = ledger.routines.find((row) => row.routine === name + "_c");
    for (const backend of ["node", "wasm"]) {
      const mapping = routine.mapping[backend];
      assert.ok(
        mapping.cspiceEntrypoints.includes(
          name === "surfpt" ? "surfpt_" : name + "_c",
        ),
      );
      if (name === "surfpt")
        assert.equal(mapping.classification, "alias-or-composed");
    }
  }
  // Each ellipse route must retain its actual same-named canonical entrypoint,
  // including INEDPL's guarded distorted-plane preflight.
  for (const name of [
    "cgv2el",
    "el2cgv",
    "saelgv",
    "pjelpl",
    "inedpl",
    "inelpl",
    "npelpt",
  ]) {
    const routine = ledger.routines.find(
      (entry) => entry.routine === name + "_c",
    );
    for (const backend of ["node", "wasm"])
      assert.ok(
        routine.mapping[backend].cspiceEntrypoints.includes(name + "_c"),
      );
  }

  assert.equal(
    ledger.audit.baselineRoutines + ledger.audit.expansionRoutines,
    ledger.summary.implemented,
  );
  for (const backend of ["node", "wasm"]) {
    assert.ok(ledger.audit.counts[backend].reviewed >= 8);
    assert.equal(ledger.audit.counts[backend].verified, 0);
  }
  assert.equal(
    ledger.routines.find((r) => r.routine === "vhat_c").audit.wasm.status,
    "reviewed",
  );
  assert.equal(
    ledger.routines.find((r) => r.routine === "kplfrm_c").audit.wasm.status,
    "unreviewed",
  );
});

test("baseline rejects duplicate, removed, and omitted routines", (t) => {
  for (const mutation of [
    (r) => r.batches[0].routines.push(r.batches[0].routines[0]),
    (r) => {
      r.batches[0].routines[0] = "missing_c";
    },
    (r) => r.batches[0].routines.pop(),
  ]) {
    const f = fixture(t);
    editAudit(f, mutation, "baseline.json");
    assert.throws(f.build, /duplicate|unknown\/removed|missing from audit/);
  }
});

test("expansion assignments cannot omit routines, duplicate baseline, or plan absent APIs", (t) => {
  for (const mutation of [
    (r) => {
      r.expansionBatches = [];
    },
    (r) => r.expansionBatches[0].routines.push(r.batches[0].routines[0]),
    (r) => r.expansionBatches[0].routines.push("clight_c"),
  ]) {
    const f = fixture(t);
    editAudit(f, mutation, "baseline.json");
    assert.throws(f.build, /duplicate|unknown\/removed|missing from audit/);
  }
});

test("audit batch dependencies reject cycles and unknown targets", (t) => {
  const f = fixture(t);
  editAudit(
    f,
    (r) => {
      r.batches[0].dependsOn = [r.batches[1].id];
      r.batches[1].dependsOn = [r.batches[0].id];
    },
    "baseline.json",
  );
  assert.throws(f.build, /cyclic batch dependency/);
});

test("audit rejects unknown and duplicate scenario identifiers", (t) => {
  for (const mutation of [
    (r) => {
      r.routines[0].scenarios[0].caseId = "removed-scenario";
    },
    (r) => {
      r.routines[0].scenarios[1] = r.routines[0].scenarios[0];
    },
  ]) {
    const f = fixture(t);
    editAudit(f, mutation);
    assert.throws(f.build, /unknown\/removed\/invalid scenario|duplicate/);
  }
});

test("audit rejects a scenario removed from its registered source", (t) => {
  const f = fixture(t);
  const target = path.join(
    f.root,
    "packages/py-parity-checking/src/cases/coords-vectors/vhat.cases.json",
  );
  const cases = JSON.parse(fs.readFileSync(target, "utf8"));
  cases.pop();
  fs.writeFileSync(target, JSON.stringify(cases));
  assert.throws(f.build, /unreviewed registered scenarios/);
});

test("review cannot jump directly to verified or omit semantic evidence", (t) => {
  const f = fixture(t);
  editAudit(f, (r) => {
    r.routines[0].backends.node.history = ["unreviewed", "verified"];
  });
  assert.throws(f.build, /invalid status transition/);
  const g = fixture(t);
  editAudit(g, (r) => {
    r.routines[0].cleanup = "";
  });
  assert.throws(g.build, /missing semantic\/contract\/cleanup evidence/);
});

test("completion requires both observed local and CI verification", (t) => {
  const f = fixture(t);
  editAudit(f, (r) => {
    r.routines[0].backends.node.history.push("verified");
  });
  editAudit(
    f,
    (r) => {
      r.batches.find((b) => b.id === "vectors-arithmetic").prs = [
        "https://github.com/rybosome/tspice/pull/1",
      ];
    },
    "baseline.json",
  );
  assert.throws(f.build, /missing local live verification/);
});

test("repaired findings require existing repair and scenario evidence", (t) => {
  const f = fixture(t);
  editAudit(f, (r) => {
    r.routines[0].findings[0].evidence = [];
  });
  assert.throws(f.build, /unsupported repaired finding/);
});

test("verification is invalidated by source drift", (t) => {
  const f = fixture(t);
  editAudit(f, (r) => {
    r.executions.push({
      id: "stale",
      kind: "local",
      backend: "wasm",
      command: "vitest run",
      result: "passed",
      sourceDigest: "0".repeat(64),
      caseIds: [],
      observation: "negative fixture",
    });
  });
  assert.throws(f.build, /stale execution source digest/);
});

test("human route judgments must agree with traced implementations", (t) => {
  const f = fixture(t);
  editAudit(f, (r) => {
    r.routines[0].backends.wasm.route = "javascript";
  });
  assert.throws(f.build, /route judgment disagrees/);
});

test("verified status accepts explicit source-bound local and observed CI evidence", (t) => {
  const f = fixture(t);
  const ledger = f.build();
  const repairEvidence = path.join(f.root, "scripts/repair-assertion.test.mjs");
  fs.writeFileSync(repairEvidence, "// maintained assertion fixture\n");
  editAudit(
    f,
    (r) => {
      r.batches.find((b) => b.id === "vectors-arithmetic").prs = [
        "https://github.com/rybosome/tspice/pull/1",
      ];
    },
    "baseline.json",
  );
  editAudit(f, (r) => {
    r.routines[0].findings[0].evidence.push(
      "scripts/repair-assertion.test.mjs",
    );
    const names = new Set(r.routines.map((entry) => entry.routine));
    const sourceDigest = auditSourceDigest(
      f.root,
      r,
      ledger.routines.filter((entry) => names.has(entry.routine)),
    );
    const caseIds = r.routines.flatMap((entry) =>
      entry.scenarios.map((scenario) => scenario.caseId),
    );
    r.executions = ["local", "ci"].map((kind) => ({
      id: kind,
      kind,
      backend: "wasm",
      command: "negative-test fixture, no real execution claim",
      result: "passed",
      sourceDigest,
      caseIds,
      observation: "synthetic validator fixture",
      url: "https://github.com/rybosome/tspice/actions/runs/1/job/1",
      commit: "1".repeat(40),
    }));
    r.routines[0].backends.wasm.executions = ["local", "ci"];
    r.routines[0].backends.wasm.history.push("verified");
  });
  assert.equal(f.build().audit.counts.wasm.verified, 1);
  fs.appendFileSync(repairEvidence, "// assertion changed\n");
  assert.throws(f.build, /stale execution source digest/);
  fs.writeFileSync(repairEvidence, "// maintained assertion fixture\n");
  f.edit(
    "packages/py-parity-checking/src/parity-assert.ts",
    "const ABSOLUTE_NUMERIC_TOLERANCE = 1e-12;",
    "const ABSOLUTE_NUMERIC_TOLERANCE = 1e-11;",
  );
  assert.throws(f.build, /stale execution source digest/);
});

// A synthetic unsupported implementation keeps the generic exception/fallback
// drift checks covered after production kplfrm no longer needs an exception.
function unsupportedFixture(t) {
  const f = fixture(t);
  fs.rmSync(path.join(f.root, "data/parity-audits/kplfrm-prerequisite.json"), {
    force: true,
  });
  const file = "packages/backend-wasm/src/domains/kernels.ts";
  const contents = fs.readFileSync(path.join(f.root, file), "utf8");
  const start = contents.indexOf("    kplfrm:");
  const end = contents.indexOf("    ktotal:", start);
  f.edit(
    file,
    contents.slice(start, end),
    `    kplfrm: () => { throw new Error("kplfrm not supported in current WASM bundle"); },\n`,
  );
  const dispatcher =
    "packages/py-parity-checking/src/run-tspice/domains/kernels.ts";
  f.edit(
    dispatcher,
    "function runKplfrmStep(",
    "function runWasmKplfrmFallback(): number[] { return []; }\nfunction runKplfrmStep(",
  );
  f.edit(
    dispatcher,
    "  const idset = context.spice.kit.newIntCell(capacity);",
    '  if (context.spice.raw.kind === "wasm") return runWasmKplfrmFallback(context, frmcls);\n  const idset = context.spice.kit.newIntCell(capacity);',
  );
  const policyFile = path.join(f.root, "data/coverage-ledger-policy.json");
  const policy = JSON.parse(fs.readFileSync(policyFile, "utf8"));
  policy.exceptions.kplfrm = {
    wasm: {
      status: "unsupported",
      reason: "synthetic exception validation fixture",
      message: "kplfrm not supported in current WASM bundle",
      errorType: "Error",
      harnessFile: dispatcher,
      harnessFunction: "runWasmKplfrmFallback",
      harnessDispatcher: "runKplfrmStep",
      operation: "kernels.kplfrm",
    },
  };
  fs.writeFileSync(policyFile, JSON.stringify(policy));
  return f;
}

test("historical executions remain visible but cannot establish current verification", (t) => {
  const f = fixture(t);
  editAudit(
    f,
    (r) => {
      r.batches.find((b) => b.id === "vectors-arithmetic").prs = [
        "https://github.com/rybosome/tspice/pull/1",
      ];
    },
    "baseline.json",
  );
  editAudit(f, (r) => {
    r.executions.push({
      id: "historical",
      kind: "local",
      backend: "wasm",
      command: "synthetic fixture",
      result: "passed",
      sourceDigest: "0".repeat(64),
      historical: true,
      caseIds: r.routines[0].scenarios.map((s) => s.caseId),
      observation: "Prior source, retained explicitly as history",
    });
    r.routines[0].backends.wasm.executions = ["historical"];
  });
  assert.equal(
    f.build().routines.find((r) => r.routine === "vadd_c").audit.wasm.status,
    "reviewed",
  );
  editAudit(f, (r) => {
    r.routines[0].backends.wasm.history.push("verified");
  });
  assert.throws(f.build, /missing local live verification/);
});
