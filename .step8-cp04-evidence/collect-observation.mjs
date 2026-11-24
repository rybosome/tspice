import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const settings = JSON.parse(readFileSync(new URL("./source.json", import.meta.url)));
const { repository, sourceRevision, testedTree, caseCount } = settings;

function request(path) {
  return execFileSync("gh", ["api", `repos/${repository}/${path}`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function normalize(log) {
  return log.replace(/\u001b\[[0-9;]*m/g, "").split(/\r?\n/)
    .map((line) => line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, "").trim());
}

export function parityTotals(log) {
  return normalize(log).flatMap((line) => {
    const match = line.match(/(?:^|\s)✓ test\/parity\.test\.ts \((\d+) tests(?: \| (\d+) skipped)?\)/);
    return match ? [{ total: Number(match[1]), skipped: Number(match[2] ?? 0) }] : [];
  });
}

export function verifyCheckout(log, expected) {
  const lines = normalize(log);
  const checkout = lines.indexOf("[command]/usr/bin/git log -1 --format=%H");
  assert(checkout >= 0, "GitHub Actions checkout is missing from the log");
  assert.equal(lines[checkout + 1], expected, "GitHub Actions tested a different commit");
}

export function verifyHosted(log) {
  assert(normalize(log).some((line) => line.startsWith(
    `${sourceRevision} ${testedTree} Rebuild Step 8 checkpoint 04 artifacts`,
  )), "The hosted rebuild log lacks the exact tested commit and tree");
  assert.deepEqual(parityTotals(log), [
    { total: 2 * caseCount, skipped: caseCount },
    { total: 2 * caseCount, skipped: 0 },
  ], "Unexpected hosted JavaScript/native parity totals");
}

export function verifyCanonical(nativeLog, javascriptLog, testedCommit) {
  verifyCheckout(nativeLog, testedCommit);
  verifyCheckout(javascriptLog, testedCommit);
  assert(normalize(nativeLog).includes("export TSPICE_EXPECT_NATIVE=true"), "Native execution guard is missing");
  assert.deepEqual(parityTotals(nativeLog), [{ total: 2 * caseCount, skipped: 0 }]);
  assert.deepEqual(parityTotals(javascriptLog), [{ total: 2 * caseCount, skipped: caseCount }]);
}

function successfulJob(jobs, name) {
  const matches = jobs.filter((job) => job.name === name);
  assert.equal(matches.length, 1, `Expected one job named ${name}`);
  const [job] = matches;
  assert.equal(job.conclusion, "success", `Job did not succeed: ${name}`);
  return job;
}

function observation(testedCommit, nativeJob, javascriptJob) {
  return {
    testedCommit,
    testedTree,
    nativeJob,
    javascriptJob,
    comparisons: 2 * caseCount,
    unexpectedSkips: 0,
    completedNativeRequired: true,
    completedJavaScriptRequired: true,
  };
}

function collect() {
  const json = (path) => JSON.parse(request(path));
  const pull = json(`pulls/${settings.pullRequest}`);
  assert.equal(pull.state, "open");
  assert.equal(pull.head.sha, sourceRevision, "PR head changed");
  const testedCommit = pull.merge_commit_sha;
  assert.match(testedCommit ?? "", /^[a-f0-9]{40}$/);
  const [head, merge] = [sourceRevision, testedCommit].map((sha) => json(`git/commits/${sha}`));
  assert.equal(head.tree.sha, testedTree);
  assert.equal(merge.tree.sha, testedTree, "GitHub's test merge changes the tested tree");
  assert(merge.parents.some(({ sha }) => sha === sourceRevision), "Test merge omits the source head");

  const run = json(`actions/runs/${settings.canonicalRun}`);
  assert.equal(run.head_sha, sourceRevision, "CI run points to a different PR head");
  assert.equal(run.event, "pull_request");
  assert.equal(run.status, "completed", "Canonical CI is still running");
  assert.equal(run.conclusion, "success", "Canonical CI did not pass");
  const { jobs } = json(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
  assert.equal(jobs.length, settings.matrixJobs, "Canonical CI matrix size changed");
  assert(jobs.every(({ conclusion }) => conclusion === "success"), "Canonical CI matrix is not all green");
  const native = successfulJob(jobs, "check-native (ubuntu-latest, 22) / run");
  const javascript = successfulJob(jobs, "check (ubuntu-latest, 22) / run");
  const hosted = json(`actions/jobs/${settings.hostedJob}`);
  assert.equal(hosted.run_id, settings.hostedRun);
  for (const step of ["Execute the required JavaScript lane", "Execute the required native lane"]) {
    const matches = hosted.steps.filter(({ name }) => name === step);
    assert.equal(matches.length, 1, step);
    assert.equal(matches[0].conclusion, "success", step);
  }
  const browser = json(`actions/jobs/${settings.browserJob}`);
  assert.equal(browser.run_id, settings.browserRun);
  assert.equal(browser.conclusion, "success");
  const logs = (id) => request(`actions/jobs/${id}/logs`);
  verifyHosted(logs(hosted.id));
  const browserLines = normalize(logs(browser.id));
  assert(browserLines.some((line) => line.startsWith(`${sourceRevision} ${testedTree} Rebuild Step 8 checkpoint 04 artifacts`)),
    "Chromium ran on a different source revision");
  assert(browserLines.some((line) => /^PASS .*readback/.test(line)), "Chromium SPK readback evidence is missing");
  verifyCanonical(logs(native.id), logs(javascript.id), testedCommit);

  const latest = json(`pulls/${settings.pullRequest}`);
  assert.equal(latest.state, "open");
  assert.equal(latest.head.sha, sourceRevision, "PR head changed while collecting results");
  assert.equal(latest.merge_commit_sha, testedCommit, "PR test merge changed while collecting results");
  return {
    sourceRevision,
    hosted: observation(sourceRevision, hosted.html_url, hosted.html_url),
    canonical: observation(testedCommit, native.html_url, javascript.html_url),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(JSON.stringify(collect(), null, 2) + "\n");
  } catch (error) {
    process.stderr.write(`Evidence collection stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
