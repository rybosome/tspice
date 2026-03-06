import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { discoverYamlFiles } from "../../src/dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../../src/dsl/loadYaml.js";
import { parseMethodSpec } from "../../src/dsl/schemaValidate.js";
import {
  BASELINE_CONTRACT_METHOD_COUNT,
  BASELINE_METHOD_SPEC_COVERAGE,
} from "../../src/guards/completenessBaseline.js";
import { validateCompleteness } from "../../src/guards/validateCompleteness.js";

describe("completeness guard", () => {
  it("validates contract coverage against generated catalogs", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const methodsDir = path.resolve(testDir, "../../specs/methods");

    const methods = await Promise.all(
      discoverYamlFiles(methodsDir).map(async (filePath) => parseMethodSpec(await loadYamlFile(filePath))),
    );

    const summary = validateCompleteness(methods);
    expect(summary.contractCount).toBe(BASELINE_CONTRACT_METHOD_COUNT);
    expect(summary.coveredCount).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(summary.denylistCount).toBe(0);
  });
});
