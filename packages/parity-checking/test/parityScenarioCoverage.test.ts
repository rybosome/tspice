import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { readContractCatalog } from "../src/generated/readContractCatalog.js";
import { readParityDenylist } from "../src/generated/readParityDenylist.js";

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
  it("covers canonical contract methods or denylist entries", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const methodsDir = path.resolve(testDir, "../specs/methods");

    const coveredCanonical = new Set<string>();
    for (const filePath of discoverYamlFiles(methodsDir)) {
      const data = parseYaml(fs.readFileSync(filePath, "utf8"));
      coveredCanonical.add(canonicalMethodFromSpecData(data, filePath));
    }

    const contract = readContractCatalog().sort(stableSort);
    const denylist = readParityDenylist();

    const denylistSorted = [...denylist].sort(stableSort);
    expect(denylist).toEqual(denylistSorted);
    expect(new Set(denylist).size).toBe(denylist.length);

    const contractSet = new Set(contract);
    const unknownDeny = denylist.filter((entry) => !contractSet.has(entry));
    expect(unknownDeny).toEqual([]);

    const missing = contract.filter((method) => !coveredCanonical.has(method) && !denylist.includes(method));
    expect(missing).toEqual([]);

    expect(contract.length).toBe(162);
    expect(coveredCanonical.size).toBe(106);
    expect(denylist.length).toBe(66);
  });
});
