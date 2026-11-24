import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const input = process.argv[2];
assert(input, "Pass the observed checkpoint validation and canonical CI record");
const observations = JSON.parse(fs.readFileSync(input, "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("rev-parse", "HEAD"), observations.sourceRevision);
assert.equal(git("status", "--porcelain"), "");
assert.match(observations.sourceRevision, /^[a-f0-9]{40}$/);
const { buildLedger } = await import(path.join(root, "scripts/generate-coverage-ledger.mjs"));
const { auditSourceDigest } = await import(path.join(root, "scripts/coverage-ledger/audits.mjs"));
const ledger = buildLedger(root);
assert.equal(ledger.summary.implemented, 561);
assert.equal(ledger.summary.scenarios, 4028);
const implemented = ledger.routines.filter((routine) => routine.contract);
const byName = new Map(implemented.map((routine) => [routine.routine, routine]));
const registered = new Set(implemented.flatMap((routine) => routine.parity.scenarios.map((c) => c.caseId)));
assert.equal(registered.size, 4028);
for (const listing of [observations.hosted, observations.canonical]) {
  assert(listing.completedNativeRequired && listing.completedJavaScriptRequired);
  assert.equal(listing.comparisons, 2 * registered.size);
  assert.equal(listing.unexpectedSkips, 0);
  assert.deepEqual(new Set(listing.observedCaseIds), registered);
  assert.match(listing.nativeJob, /^https:\/\/github\.com\/rybosome\/tspice\/actions\/runs\/\d+\/job\/\d+$/);
}
assert.equal(observations.canonical.testedTree, git("rev-parse", "HEAD^{tree}"));
assert.equal(observations.hosted.testedTree, observations.canonical.testedTree);
assert.match(observations.canonical.testedCommit, /^[a-f0-9]{40}$/);
assert.equal(observations.hosted.testedCommit, observations.sourceRevision);

const checkpoint = observations.sourceRevision.slice(0, 12);
const directory = path.join(root, "data/parity-audits");
const owners = JSON.parse(fs.readFileSync(path.join(directory, "baseline.json"), "utf8"));
const output = [];
const digests = new Map();
for (const batch of [...owners.batches, ...owners.expansionBatches]) {
  const filename = path.join(directory, `${batch.id}.json`);
  const record = JSON.parse(fs.readFileSync(filename, "utf8"));
  const routines = batch.routines.map((name) => byName.get(name));
  const caseIds = [...new Set(routines.flatMap((r) => r.parity.scenarios.map((c) => c.caseId)))].sort();
  const sourceDigest = auditSourceDigest(root, record, routines);
  digests.set(batch.id, sourceDigest);
  assert(record.executions.every((run) => run.historical));
  for (const backend of ["node", "wasm"]) {
    const command = "TSPICE_EXPECT_NATIVE=true pnpm run check:native:required";
    const localId = `local-cp04-${checkpoint}-${backend}`;
    const ciId = `ci-cp04-${checkpoint}-${backend}`;
    const common = {
      backend, command, result: "passed", nativeRequired: true, sourceDigest, caseIds,
    };
    assert(record.executions.every((run) => run.id !== localId && run.id !== ciId));
    record.executions.push({
      ...common,
      id: localId,
      kind: "local",
      observation: `The isolated Linux Node 22 validation runner exercised both complete lanes on ${observations.sourceRevision}. The native-required lane completed ${observations.hosted.comparisons} comparisons without unexpected skips. ${observations.hosted.nativeJob}`,
    }, {
      ...common,
      id: ciId,
      kind: "ci",
      commit: observations.canonical.testedCommit,
      url: observations.canonical.nativeJob,
      observation: `The canonical Linux Node 22 native-required job tested the source revision tree and exercised ${observations.canonical.comparisons} live comparisons without unexpected skips.`,
    });
    for (const routine of record.routines) {
      const status = routine.backends[backend];
      assert.equal(status.history.at(-1), "reviewed", `${backend}.${routine.routine}`);
      assert(routine.findings.every((finding) => finding.status === "repaired"), routine.routine);
      status.history.push("verified");
      status.executions = [localId, ciId];
    }
  }
  output.push({ filename, record, routines, original: fs.readFileSync(filename, "utf8") });
}
try {
  for (const { filename, record } of output) {
    fs.writeFileSync(filename, JSON.stringify(record, null, 2) + "\n");
  }
  for (const { record, routines } of output) {
    assert.equal(auditSourceDigest(root, record, routines), digests.get(record.batch), record.batch);
  }
  const verified = buildLedger(root);
  for (const report of verified.routines.filter((r) => r.contract)) {
    assert.equal(report.audit.node.status, "verified", report.routine);
    assert.equal(report.audit.wasm.status, "verified", report.routine);
  }
} catch (error) {
  for (const { filename, original } of output) fs.writeFileSync(filename, original);
  throw error;
}
console.log(JSON.stringify({ source: observations.sourceRevision, digests: Object.fromEntries(digests) }, null, 2));
