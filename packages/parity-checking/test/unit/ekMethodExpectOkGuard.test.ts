import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

describe("EK method v2 expect.ok guard", () => {
  it("requires explicit expect.ok=true for non-failure EK cases", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const ekDir = path.resolve(testDir, "../../specs/methods/ek");
    const files = fs.readdirSync(ekDir).filter((file) => file.endsWith("@v2.yml")).sort();

    const missing: string[] = [];

    for (const file of files) {
      const abs = path.join(ekDir, file);
      const data = parseYaml(fs.readFileSync(abs, "utf8")) as {
        cases?: Array<{ id?: string; expect?: { ok?: boolean } }>;
      };

      for (const scenarioCase of data.cases ?? []) {
        if (scenarioCase.expect?.ok === false) {
          continue;
        }

        if (scenarioCase.expect?.ok !== true) {
          missing.push(`${file}::${scenarioCase.id ?? "<unknown-case>"}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
