#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const contractCatalogPath = path.resolve(packageRoot, "catalogs/contract-methods.json");
const mappingMatrixPath = path.resolve(packageRoot, "catalogs/cspice-mapping-matrix.json");

function readJson(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function fail(message) {
  console.error(`[parity-checking] ${message}`);
  process.exit(1);
}

const contractMethods = readJson(contractCatalogPath);
if (!Array.isArray(contractMethods) || contractMethods.some((item) => typeof item !== "string")) {
  fail(`invalid contract catalog shape: expected string[] in ${contractCatalogPath}`);
}

const matrix = readJson(mappingMatrixPath);
if (!matrix || typeof matrix !== "object") {
  fail(`invalid mapping matrix shape: expected object in ${mappingMatrixPath}`);
}

const entries = matrix.entries;
if (!Array.isArray(entries)) {
  fail(`invalid mapping matrix shape: expected entries[] in ${mappingMatrixPath}`);
}

const contractSet = new Set(contractMethods);
const seenMethods = new Set();
const validCoverage = new Set();

const duplicates = [];
const unknownMethods = [];
const invalidEntries = [];

let directMappings = 0;
let nonDirectCompositeMappings = 0;

for (const [index, entry] of entries.entries()) {
  if (!entry || typeof entry !== "object") {
    invalidEntries.push(`entries[${index}] must be an object`);
    continue;
  }

  const method = entry.method;
  const status = entry.status;
  const hasSymbol = typeof entry.cspiceSymbol === "string" && entry.cspiceSymbol.trim().length > 0;
  const hasRationale = typeof entry.rationale === "string" && entry.rationale.trim().length > 0;

  if (typeof method !== "string" || method.trim().length === 0) {
    invalidEntries.push(`entries[${index}] has invalid method`);
    continue;
  }

  if (seenMethods.has(method)) {
    duplicates.push(method);
  } else {
    seenMethods.add(method);
  }

  if (!contractSet.has(method)) {
    unknownMethods.push(method);
  }

  if (status === "direct") {
    directMappings += 1;
    if (!hasSymbol) {
      invalidEntries.push(`${method}: direct mappings require non-empty cspiceSymbol`);
      continue;
    }
    if (hasRationale) {
      invalidEntries.push(`${method}: direct mappings must not include rationale`);
      continue;
    }
    validCoverage.add(method);
    continue;
  }

  if (status === "non-direct/composite") {
    nonDirectCompositeMappings += 1;
    if (!hasRationale) {
      invalidEntries.push(`${method}: non-direct/composite mappings require non-empty rationale`);
      continue;
    }
    if (hasSymbol) {
      invalidEntries.push(`${method}: non-direct/composite mappings must not include cspiceSymbol`);
      continue;
    }
    validCoverage.add(method);
    continue;
  }

  invalidEntries.push(`${method}: status must be "direct" or "non-direct/composite"`);
}

const unmapped = contractMethods.filter((method) => !validCoverage.has(method));

const summary = {
  totalMethods: contractMethods.length,
  matrixEntries: entries.length,
  directMappings,
  nonDirectCompositeMappings,
  mappedMethods: contractMethods.length - unmapped.length,
  unmappedMethods: unmapped.length,
};

if (
  matrix.summary
  && typeof matrix.summary === "object"
  && matrix.summary !== null
) {
  const expectedSummary = {
    totalMethods: summary.totalMethods,
    directMappings: summary.directMappings,
    nonDirectCompositeMappings: summary.nonDirectCompositeMappings,
  };

  for (const [key, expectedValue] of Object.entries(expectedSummary)) {
    const actualValue = matrix.summary[key];
    if (actualValue !== expectedValue) {
      invalidEntries.push(
        `summary.${key} mismatch: expected ${expectedValue}, got ${actualValue}`,
      );
    }
  }
}

console.log("[parity-checking] CSPICE mapping matrix validation summary");
for (const [key, value] of Object.entries(summary)) {
  console.log(`  ${key}: ${value}`);
}

if (duplicates.length > 0) {
  console.error("[parity-checking] duplicate mapping entries:");
  for (const method of [...new Set(duplicates)].sort()) {
    console.error(`  - ${method}`);
  }
}

if (unknownMethods.length > 0) {
  console.error("[parity-checking] mapping entries for unknown methods:");
  for (const method of [...new Set(unknownMethods)].sort()) {
    console.error(`  - ${method}`);
  }
}

if (invalidEntries.length > 0) {
  console.error("[parity-checking] invalid mapping entries:");
  for (const issue of invalidEntries) {
    console.error(`  - ${issue}`);
  }
}

if (unmapped.length > 0) {
  console.error("[parity-checking] unmapped methods:");
  for (const method of unmapped) {
    console.error(`  - ${method}`);
  }
}

const hasErrors = duplicates.length > 0
  || unknownMethods.length > 0
  || invalidEntries.length > 0
  || unmapped.length > 0;

if (hasErrors) {
  process.exit(1);
}

console.log("[parity-checking] mapping matrix is complete (0 unmapped methods).");
