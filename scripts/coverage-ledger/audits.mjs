import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const directory = "data/parity-audits";
const backends = ["node", "wasm"];
const transitions = {
  unreviewed: ["reviewed", "needs-repair"],
  reviewed: ["needs-repair", "verified"],
  "needs-repair": ["reviewed", "verified"],
  verified: ["reviewed", "needs-repair"],
};
function requireValue(condition, message) {
  if (!condition) throw new Error(`Parity audit: ${message}`);
}
function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function unique(values, label) {
  requireValue(
    Array.isArray(values) && new Set(values).size === values.length,
    `duplicate or invalid ${label}`,
  );
}
function checkedPath(root, file) {
  requireValue(
    text(file) && !path.isAbsolute(file) && !file.split(/[\\/]/).includes(".."),
    `invalid evidence path ${file}`,
  );
  requireValue(
    fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile(),
    `missing evidence file ${file}`,
  );
  return file;
}
function read(root, file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

export function auditSourceDigest(root, record, routines) {
  const files = new Set([
    ...record.traceFiles,
    "packages/backend-wasm/emscripten/tspice_backend_wasm.wasm",
    "packages/py-parity-checking/src/parity-assert.ts",
    "packages/py-parity-checking/test/parity.test.ts",
    "packages/py-parity-checking/sidecars/spiceypy/uv.lock",
  ]);
  for (const review of record.routines) {
    for (const fixture of review.fixtures) files.add(fixture.path);
    for (const finding of review.findings)
      for (const file of finding.evidence ?? []) files.add(file);
  }
  for (const routine of routines) {
    files.add(routine.contract.evidence.file);
    for (const backend of backends) {
      files.add(routine.backends[backend].evidence.file);
      for (const native of routine.backends[backend].nativeExports ?? [])
        files.add(native.evidence.file);
    }
    for (const shim of routine.shim) {
      files.add(shim.declaration.file);
      files.add(shim.definition.file);
    }
    for (const scenario of routine.parity.scenarios) files.add(scenario.source);
  }
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    checkedPath(root, file);
    hash
      .update(file)
      .update("\0")
      .update(fs.readFileSync(path.join(root, file)))
      .update("\0");
  }
  return hash.digest("hex");
}

// Human judgments are maintained inputs. Static registration is never promoted
// to reviewed/verified. Execution claims are explicit, source-bound observations,
// separate from the ledger's configured CI lanes.
export function applyAudits(root, routines) {
  const baseline = read(root, `${directory}/baseline.json`);
  requireValue(
    baseline.schemaVersion === 1 &&
      /^[a-f0-9]{40}$/.test(baseline.baselineCommit),
    "invalid baseline version/commit",
  );
  const byName = new Map(
    routines.filter((r) => r.contract).map((r) => [r.routine, r]),
  );
  // Keep the Step 7 denominator immutable while applying the same acceptance
  // rules to newly implemented Step 8 batches. Unimplemented queue entries do
  // not belong here and cannot acquire an audit status through planning alone.
  const expansionBatches = baseline.expansionBatches ?? [];
  requireValue(Array.isArray(expansionBatches), "invalid expansion batches");
  const batches = [...baseline.batches, ...expansionBatches];
  unique(
    batches.map((b) => b.id),
    "batch identifiers",
  );
  const assigned = new Set();
  const records = new Map();
  for (const batch of batches) {
    requireValue(
      /^[a-z][a-z0-9-]*$/.test(batch.id) && text(batch.nextAction),
      "invalid batch identifier/next action",
    );
    unique(batch.routines, `routines in ${batch.id}`);
    unique(batch.dependsOn, `dependencies in ${batch.id}`);
    requireValue(batch.routines.length > 0, `empty batch ${batch.id}`);
    for (const dependency of batch.dependsOn)
      requireValue(
        dependency !== batch.id && batches.some((b) => b.id === dependency),
        `unknown/self batch dependency ${dependency}`,
      );
    requireValue(
      Array.isArray(batch.prs) &&
        batch.prs.every((url) =>
          /^https:\/\/github.com\/rybosome\/tspice\/pull\/\d+$/.test(url),
        ),
      `invalid PRs in ${batch.id}`,
    );
    for (const name of batch.routines) {
      requireValue(
        byName.has(name) && !assigned.has(name),
        `unknown/removed/duplicate baseline routine ${name}`,
      );
      assigned.add(name);
      const routine = byName.get(name);
      routine.audit = {
        batch: batch.id,
        node: { status: "unreviewed" },
        wasm: { status: "unreviewed" },
      };
    }
  }
  requireValue(
    assigned.size === byName.size,
    "contract-present routines missing from audit assignments",
  );
  const visit = (id, ancestors = []) => {
    requireValue(!ancestors.includes(id), `cyclic batch dependency ${id}`);
    for (const dependency of batches.find((b) => b.id === id).dependsOn)
      visit(dependency, [...ancestors, id]);
  };
  for (const batch of batches) visit(batch.id);
  for (const file of fs.readdirSync(path.join(root, directory)).sort()) {
    if (file === "baseline.json") continue;
    requireValue(
      file.endsWith(".json"),
      `unexpected maintained audit input ${file}`,
    );
    const record = read(root, `${directory}/${file}`);
    const batch = batches.find((b) => b.id === record.batch);
    requireValue(
      batch &&
        file === `${batch.id}.json` &&
        !records.has(batch.id) &&
        record.schemaVersion === 1,
      `unknown/duplicate audit batch ${file}`,
    );
    records.set(batch.id, record);
    unique(record.traceFiles, `trace files in ${file}`);
    record.traceFiles.forEach((p) => checkedPath(root, p));
    unique(
      record.routines.map((r) => r.routine),
      `reviewed routines in ${file}`,
    );
    unique(
      record.executions.map((e) => e.id),
      `execution identifiers in ${file}`,
    );
    const digest = auditSourceDigest(
      root,
      record,
      batch.routines.map((n) => byName.get(n)),
    );
    for (const execution of record.executions) {
      requireValue(
        backends.includes(execution.backend) &&
          ["local", "ci"].includes(execution.kind) &&
          text(execution.command) &&
          execution.result === "passed",
        `invalid execution ${execution.id}`,
      );
      requireValue(
        execution.sourceDigest === digest ||
          (execution.historical === true &&
            /^[a-f0-9]{64}$/.test(execution.sourceDigest)),
        `stale execution source digest ${execution.id}`,
      );
      unique(execution.caseIds, `executed case identifiers in ${execution.id}`);
      const knownCases = new Set(
        batch.routines.flatMap((n) =>
          byName.get(n).parity.scenarios.map((s) => s.caseId),
        ),
      );
      requireValue(
        execution.caseIds.length > 0 &&
          execution.caseIds.every((id) => knownCases.has(id)),
        `unknown/removed executed scenario in ${execution.id}`,
      );
      requireValue(
        execution.backend !== "node" || execution.nativeRequired === true,
        `native execution not required in ${execution.id}`,
      );
      requireValue(
        execution.kind !== "ci" ||
          (/^https:\/\/github.com\/rybosome\/tspice\/actions\/runs\/\d+\/job\/\d+$/.test(
            execution.url,
          ) &&
            /^[a-f0-9]{40}$/.test(execution.commit)),
        `missing observed CI job/commit in ${execution.id}`,
      );
      requireValue(
        text(execution.observation),
        `missing execution observation in ${execution.id}`,
      );
    }
    for (const review of record.routines) {
      const name = review.routine;
      requireValue(
        batch.routines.includes(name),
        `unknown/unassigned reviewed routine ${name}`,
      );
      const routine = byName.get(name);
      requireValue(
        review.contract === routine.contract.evidence.file &&
          text(review.semantics) &&
          text(review.cleanup) &&
          text(review.tolerance),
        `missing semantic/contract/cleanup evidence for ${name}`,
      );
      requireValue(
        review.naif ===
          `https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/${name}.html` ||
          (Array.isArray(review.naif) &&
            review.naif.length > 0 &&
            review.naif.every((u) =>
              u.startsWith("https://naif.jpl.nasa.gov/"),
            )),
        `missing primary documentation for ${name}`,
      );
      requireValue(
        Array.isArray(review.fixtures) && text(review.fixtureRationale),
        `missing fixture assessment for ${name}`,
      );
      for (const fixture of review.fixtures) {
        checkedPath(root, fixture.path);
        requireValue(
          text(fixture.provenance) && text(fixture.distribution),
          `missing fixture provenance for ${name}`,
        );
      }
      unique(
        review.scenarios.map((s) => s.caseId),
        `scenario identifiers for ${name}`,
      );
      const scenarios = new Map(
        routine.parity.scenarios.map((s) => [s.caseId, s]),
      );
      requireValue(
        review.scenarios.length === scenarios.size,
        `unreviewed registered scenarios for ${name}`,
      );
      for (const scenario of review.scenarios) {
        const actual = scenarios.get(scenario.caseId);
        requireValue(
          actual &&
            text(scenario.observes) &&
            Array.isArray(scenario.coverage) &&
            scenario.coverage.length > 0 &&
            scenario.coverage.every((k) =>
              ["success", "edge", "error", "state"].includes(k),
            ),
          `unknown/removed/invalid scenario ${scenario.caseId} for ${name}`,
        );
        requireValue(
          !scenario.coverage.includes("success") ||
            actual.expectation === "success",
          `error case claimed as success ${scenario.caseId}`,
        );
        requireValue(
          !scenario.coverage.includes("error") ||
            actual.expectation === "error",
          `success case claimed as error ${scenario.caseId}`,
        );
      }
      requireValue(
        text(review.edgeAssessment) && text(review.errorAssessment),
        `missing edge/error assessment for ${name}`,
      );
      requireValue(
        Array.isArray(review.findings),
        `missing findings for ${name}`,
      );
      unique(
        review.findings.map((f) => f.id),
        `finding identifiers for ${name}`,
      );
      for (const finding of review.findings) {
        requireValue(
          text(finding.summary) &&
            ["open", "repaired"].includes(finding.status),
          `invalid finding for ${name}`,
        );
        if (finding.status === "repaired") {
          requireValue(
            text(finding.repair) &&
              finding.evidence?.length > 0 &&
              finding.caseIds?.length > 0,
            `unsupported repaired finding for ${name}`,
          );
          finding.evidence.forEach((p) => checkedPath(root, p));
          requireValue(
            finding.caseIds.every((id) => scenarios.has(id)),
            `unknown repair scenario for ${name}`,
          );
        }
      }
      for (const backend of backends) {
        const judgment = review.backends?.[backend];
        requireValue(
          judgment &&
            Array.isArray(judgment.history) &&
            judgment.history[0] === "unreviewed" &&
            judgment.history.length > 1,
          `missing review history for ${backend}.${name}`,
        );
        for (let i = 1; i < judgment.history.length; i++)
          requireValue(
            transitions[judgment.history[i - 1]]?.includes(judgment.history[i]),
            `invalid status transition for ${backend}.${name}`,
          );
        const status = judgment.history.at(-1);
        requireValue(
          [
            "direct",
            "composed",
            "alias",
            "javascript",
            "cached",
            "unsupported",
          ].includes(judgment.route) && text(judgment.trace),
          `missing route judgment for ${backend}.${name}`,
        );
        const mapping = routine.mapping[backend].classification;
        const allowedRoutes = {
          "same-named-cspice-entrypoint": ["direct", "cached"],
          "alias-or-composed": ["composed", "alias"],
          "javascript-implementation": ["javascript"],
          unsupported: ["unsupported"],
        };
        requireValue(
          allowedRoutes[mapping]?.includes(judgment.route),
          `route judgment disagrees with implementation for ${backend}.${name}`,
        );
        unique(
          judgment.executions,
          `verification identifiers for ${backend}.${name}`,
        );
        const executions = judgment.executions.map((id) =>
          record.executions.find((e) => e.id === id && e.backend === backend),
        );
        requireValue(
          executions.every(Boolean),
          `unknown/wrong-backend verification for ${backend}.${name}`,
        );
        if (status === "verified") {
          requireValue(
            batch.prs.length > 0,
            `missing repair/audit PR reference for ${backend}.${name}`,
          );
          requireValue(
            routine.backends[backend].status !== "unsupported" &&
              judgment.route !== "unsupported",
            `unsupported raw implementation claimed verified for ${backend}.${name}`,
          );
          requireValue(
            review.findings.every((f) => f.status === "repaired") &&
              review.scenarios.some((s) => s.coverage.includes("success")),
            `incomplete repair/success evidence for ${backend}.${name}`,
          );
          for (const kind of ["local", "ci"])
            requireValue(
              executions.some(
                (e) =>
                  e.kind === kind &&
                  e.historical !== true &&
                  e.sourceDigest === digest &&
                  review.scenarios.every((s) => e.caseIds.includes(s.caseId)),
              ),
              `missing ${kind} live verification for ${backend}.${name}`,
            );
        }
        routine.audit[backend] = {
          ...judgment,
          status,
          record: `${directory}/${file}`,
        };
      }
      routine.mapping.semanticEquivalence =
        "reviewed; see maintained per-backend audit and verification status";
      for (const scenario of routine.parity.scenarios) {
        const judgment = review.scenarios.find(
          (s) => s.caseId === scenario.caseId,
        );
        scenario.assertionQuality = {
          coverage: judgment.coverage,
          observes: judgment.observes,
          record: `${directory}/${file}`,
        };
      }
      routine.parity.meaningfulCoverage =
        "maintained-per-backend-audit; see audit status and evidence";
    }
  }
  return {
    baselineCommit: baseline.baselineCommit,
    baselineRoutines: baseline.batches.reduce(
      (sum, batch) => sum + batch.routines.length,
      0,
    ),
    expansionRoutines: expansionBatches.reduce(
      (sum, batch) => sum + batch.routines.length,
      0,
    ),
    batches: batches.map((b) => ({
      ...b,
      record: records.has(b.id) ? `${directory}/${b.id}.json` : null,
    })),
    counts: Object.fromEntries(
      backends.map((backend) => [
        backend,
        Object.fromEntries(
          Object.keys(transitions).map((status) => [
            status,
            [...assigned].filter(
              (n) => byName.get(n).audit[backend].status === status,
            ).length,
          ]),
        ),
      ]),
    ),
  };
}
