import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { parseMethodSpec } from "../../src/dsl/schemaValidate.js";
import { validateCompleteness } from "../../src/guards/validateCompleteness.js";

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

describe("completeness guard", () => {
  it("validates contract coverage against generated catalogs", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const methodsDir = path.resolve(testDir, "../../specs/methods");

    const methods = discoverYamlFiles(methodsDir).map((filePath) =>
      parseMethodSpec({
        sourcePath: filePath,
        data: parseYaml(fs.readFileSync(filePath, "utf8")),
      }),
    );

    const summary = validateCompleteness(methods);
    expect(summary.contractCount).toBe(173);
    expect(summary.coveredCount).toBe(136);
    expect(summary.denylistCount).toBe(37);
  });
});
