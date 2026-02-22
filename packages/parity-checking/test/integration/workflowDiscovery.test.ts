import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { buildWorkflowIndex } from "../../src/dsl/buildWorkflowIndex.js";
import { parseWorkflowSpec } from "../../src/dsl/schemaValidate.js";

function discoverYamlFiles(rootDir: string): string[] {
  const out: string[] = [];

  const visit = (dir: string) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
      } else if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
        out.push(abs);
      }
    }
  };

  visit(rootDir);
  return out;
}

describe("workflow discovery", () => {
  it("discovers the EK fast-write sentinel workflow", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const workflowsDir = path.resolve(testDir, "../../workflows");

    const workflows = discoverYamlFiles(workflowsDir).map((filePath) =>
      parseWorkflowSpec({
        sourcePath: filePath,
        data: parseYaml(fs.readFileSync(filePath, "utf8")),
      }),
    );

    const workflowIndex = buildWorkflowIndex(workflows);
    const workflow = workflowIndex.get("workflow.legacy.ek.fast-write@v1");

    expect(workflow).toBeDefined();
    expect(workflow?.notes?.some((note) => note.includes("wiring-only"))).toBe(true);
  });
});
