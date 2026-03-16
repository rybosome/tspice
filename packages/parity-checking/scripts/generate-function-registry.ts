import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import {
  parseFunctionRegistryFunction,
  parseFunctionRegistryManifest,
} from "../src/dsl/functionRegistryValidate.js";

import type {
  FunctionRegistryCatalog,
  FunctionRegistryFunctionSpec,
} from "../src/dsl/functionRegistryTypes.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const registryRoot = path.resolve(packageRoot, "specs/function-registry");
const functionsRoot = path.join(registryRoot, "functions");

const manifestPath = path.join(registryRoot, "manifest.yaml");
const outputPath = path.resolve(packageRoot, "catalogs/function-registry.json");

function readYamlFile(sourcePath: string): { sourcePath: string; text: string; data: unknown } {
  const text = fs.readFileSync(sourcePath, "utf8");
  return {
    sourcePath,
    text,
    data: parseYaml(text),
  };
}

function canonicalizeFunctionSpec(spec: FunctionRegistryFunctionSpec): FunctionRegistryFunctionSpec {
  return {
    key: spec.key,
    input: { ...spec.input },
    ...(spec.output === undefined ? {} : { output: { ...spec.output } }),
    ...(spec.buffers === undefined ? {} : { buffers: { ...spec.buffers } }),
  };
}

function buildCatalog(): FunctionRegistryCatalog {
  const manifestFile = readYamlFile(manifestPath);
  const manifest = parseFunctionRegistryManifest(manifestFile);

  const functions = manifest.functions.map((entry) => {
    const filePath = path.join(functionsRoot, entry.file);
    const parsed = parseFunctionRegistryFunction(readYamlFile(filePath));

    if (parsed.key !== entry.key) {
      throw new TypeError(
        `Function key mismatch for ${entry.file}: manifest key=${JSON.stringify(entry.key)} function key=${JSON.stringify(parsed.key)}`,
      );
    }

    return canonicalizeFunctionSpec(parsed);
  });

  const deduped = new Map<string, FunctionRegistryFunctionSpec>();
  for (const fn of functions) {
    deduped.set(fn.key, fn);
  }

  const sortedFunctions = [...deduped.values()].sort((a, b) => stableSort(a.key, b.key));

  return {
    dslVersion: manifest.dslVersion,
    functions: sortedFunctions,
  };
}

const catalog = buildCatalog();

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(`[parity-checking] wrote function registry (${catalog.functions.length}) -> ${outputPath}`);
