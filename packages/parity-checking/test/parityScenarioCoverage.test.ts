import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { discoverYamlFiles } from "../src/dsl/discoverYamlFiles.js";
import { loadYamlFile } from "../src/dsl/loadYaml.js";
import { readMethodSurfaceRegistry } from "../src/generated/readMethodSurfaceRegistry.js";
import { readParityDenylist } from "../src/generated/readParityDenylist.js";
import { BASELINE_METHOD_SPEC_COVERAGE } from "../src/guards/completenessBaseline.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalMethodFromSpecData(data: unknown, filePath: string): string {
  if (!isRecord(data)) {
    throw new Error(`Method spec must be an object: ${filePath}`);
  }

  if (typeof data.canonicalMethod === "string") {
    return data.canonicalMethod;
  }

  if (isRecord(data.contract) && typeof data.contract.canonicalMethod === "string") {
    return data.contract.canonicalMethod;
  }

  throw new Error(`Missing canonicalMethod in ${filePath}`);
}

describe("parity-checking spec coverage", () => {
  it("pins v3 baseline method-spec coverage, method-surface registry parity, and empty denylist", async () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const methodsDir = path.resolve(testDir, "../specs/methods");

    const coveredCanonical = new Set<string>();
    const methodFiles = discoverYamlFiles(methodsDir);
    for (const filePath of methodFiles) {
      const { data } = await loadYamlFile(filePath);
      if (isRecord(data)) {
        expect(data.schemaVersion).toBe(3);
      }
      coveredCanonical.add(canonicalMethodFromSpecData(data, filePath));
    }

    const methodSurfaceRegistry = readMethodSurfaceRegistry();
    const methodSurfaceCanonical = methodSurfaceRegistry.map((entry) => entry.canonicalMethod).sort(stableSort);
    const coveredCanonicalSorted = [...coveredCanonical].sort(stableSort);

    const denylist = readParityDenylist();

    const denylistSorted = [...denylist].sort(stableSort);
    expect(denylist).toEqual(denylistSorted);
    expect(new Set(denylist).size).toBe(denylist.length);

    expect(methodFiles.length).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(coveredCanonical.size).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(methodSurfaceRegistry.length).toBe(BASELINE_METHOD_SPEC_COVERAGE);
    expect(coveredCanonicalSorted).toEqual(methodSurfaceCanonical);
    expect(denylist.length).toBe(0);
  });
});
