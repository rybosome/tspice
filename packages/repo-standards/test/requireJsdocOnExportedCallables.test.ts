import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRepoContext } from "../src/indexing/buildRepoContext.js";
import { sortViolations } from "../src/reporting/sortViolations.js";
import { run } from "../src/rules/requireJsdocOnExportedCallables.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, "fixtures", "jsdoc-rule-repo");

describe("rule: require-jsdoc-on-exported-callables", () => {
  it("reports missing/empty JSDoc with stable locations", { timeout: 20_000 }, async () => {
    const ctx = await buildRepoContext({
      repoRoot: fixtureRoot,
      packageRoots: ["packages/pkg-a"]
    });

    const violations = sortViolations(await run({ ctx, packageRoot: "packages/pkg-a" }));

    expect(violations).toEqual([
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
    ]);
  });
});
