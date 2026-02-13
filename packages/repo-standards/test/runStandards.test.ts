import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RepoStandardsConfig } from "../src/config/types.js";
import { runStandards } from "../src/engine/run.js";
import { sortViolations } from "../src/reporting/sortViolations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "jsdoc-rule-repo");

const config: RepoStandardsConfig = {
  schemaVersion: 1,
  rules: {
    "require-jsdoc-on-exported-callables": {
      packages: ["packages/pkg-a", "packages/pkg-b"]
    },
    "require-parity-scenario-for-backend-method": {
      packages: ["packages/pkg-a"]
    },
    "require-perf-benchmark-for-backend-method": {
      packages: []
    }
  }
};

const expectedPkgAViolations = [
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "missingDoc" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/callables.ts",
      line: 4,
      col: 17,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/callables.ts:4:17:missingDoc"
    }
  },
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "emptyDoc" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/callables.ts",
      line: 9,
      col: 17,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/callables.ts:9:17:emptyDoc"
    }
  },
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "commentBetween" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/callables.ts",
      line: 17,
      col: 17,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/callables.ts:17:17:commentBetween"
    }
  },
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "arrowMissingDoc" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/callables.ts",
      line: 22,
      col: 14,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/callables.ts:22:14:arrowMissingDoc"
    }
  },
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "fnExprMissingDoc" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/callables.ts",
      line: 27,
      col: 14,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/callables.ts:27:14:fnExprMissingDoc"
    }
  },
  {
    ruleId: "require-jsdoc-on-exported-callables",
    packageRoot: "packages/pkg-a",
    message: 'exported callable "aliasNoDoc" is missing JSDoc',
    location: {
      filePath: "packages/pkg-a/src/reexported.ts",
      line: 1,
      col: 17,
      callId: "exported-callable:packages/pkg-a:packages/pkg-a/src/reexported.ts:1:17:aliasNoDoc"
    }
  }
];

describe("engine: runStandards", () => {
  // This test can be slow on GitHub macOS runners (native FS + module load).
  it("executes configured rules and respects onlyRuleId/onlyPackageRoot", { timeout: 60_000 }, async () => {
    const baseline = await runStandards({
      repoRoot: fixtureRoot,
      configPath: "repo-standards.yml",
      config
    });

    expect(sortViolations(baseline.violations)).toEqual(expectedPkgAViolations);

    const onlyStubRule = await runStandards({
      repoRoot: fixtureRoot,
      configPath: "repo-standards.yml",
      config,
      onlyRuleId: "require-parity-scenario-for-backend-method"
    });

    expect(onlyStubRule.violations).toEqual([]);

    const onlyPkgB = await runStandards({
      repoRoot: fixtureRoot,
      configPath: "repo-standards.yml",
      config,
      onlyPackageRoot: "packages/pkg-b"
    });

    expect(onlyPkgB.violations).toEqual([]);
  });
});
