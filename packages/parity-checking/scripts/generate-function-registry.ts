import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import { methodCanonicalMethod } from "../src/dsl/types.js";
import { loadParitySpecs } from "../src/engine/loadParitySpecs.js";
import { parseFunctionRegistrySource } from "../src/dsl/functionRegistryValidate.js";

import type {
  FunctionRegistryBufferSpec,
  FunctionRegistryCatalog,
  FunctionRegistryFunctionSpec,
} from "../src/dsl/functionRegistryTypes.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const sourcePath = path.resolve(packageRoot, "specs/function-registry/function-registry.yaml");
const outputPath = path.resolve(packageRoot, "catalogs/function-registry.json");

function readYamlFile(filePath: string): { sourcePath: string; text: string; data: unknown } {
  const text = fs.readFileSync(filePath, "utf8");
  return {
    sourcePath: filePath,
    text,
    data: parseYaml(text),
  };
}

function canonicalizeBufferSpec(spec: FunctionRegistryBufferSpec): FunctionRegistryBufferSpec {
  if ("bytes" in spec) {
    return {
      bytes: { ...spec.bytes },
      ...(spec.elementType === undefined ? {} : { elementType: spec.elementType }),
    };
  }

  return {
    lengthFrom: spec.lengthFrom,
    ...(spec.elementType === undefined ? {} : { elementType: spec.elementType }),
  };
}

function canonicalizeFunctionSpec(spec: FunctionRegistryFunctionSpec): FunctionRegistryFunctionSpec {
  return {
    key: spec.key,
    input: [...spec.input],
    ...(spec.output === undefined
      ? {}
      : {
          output:
            "value" in spec.output
              ? {
                  value: {
                    from: spec.output.value.from,
                    ...(spec.output.value.type === undefined
                      ? {}
                      : {
                          type: spec.output.value.type,
                        }),
                  },
                }
              : {
                  payload: { ...spec.output.payload },
                },
        }),
    ...(spec.buffers === undefined
      ? {}
      : {
          buffers: Object.fromEntries(
            Object.entries(spec.buffers).map(([bufferName, bufferSpec]) => [
              bufferName,
              canonicalizeBufferSpec(bufferSpec),
            ]),
          ),
        }),
  };
}

function assertNoDuplicateKeys(functions: FunctionRegistryFunctionSpec[]): void {
  const seenKeys = new Set<string>();
  for (const fn of functions) {
    if (seenKeys.has(fn.key)) {
      throw new TypeError(
        `functionRegistrySource.functions contains duplicate key ${JSON.stringify(fn.key)}. Remove duplicates from specs/function-registry/function-registry.yaml.`,
      );
    }
    seenKeys.add(fn.key);
  }
}

function buildCatalog(): FunctionRegistryCatalog {
  const source = parseFunctionRegistrySource(readYamlFile(sourcePath));

  const functions = source.functions.map((entry) => canonicalizeFunctionSpec(entry));
  assertNoDuplicateKeys(functions);

  const sortedFunctions = [...functions].sort((a, b) => stableSort(a.key, b.key));

  return {
    dslVersion: source.dslVersion,
    functions: sortedFunctions,
  };
}

function joinPreview(values: string[]): string {
  const preview = values.slice(0, 8);
  const suffix = values.length > 8 ? ", ..." : "";
  return `${preview.join(", ")}${suffix}`;
}

async function assertParityCoverageInvariant(catalog: FunctionRegistryCatalog): Promise<void> {
  const specs = await loadParitySpecs();
  const parityMethods = [...new Set(specs.methods.map((method) => methodCanonicalMethod(method)))].sort(
    (a, b) => stableSort(a, b),
  );

  const paritySet = new Set(parityMethods);
  const registryKeys = catalog.functions.map((fn) => fn.key);
  const registrySet = new Set(registryKeys);

  const missing = parityMethods.filter((key) => !registrySet.has(key));
  const extra = registryKeys.filter((key) => !paritySet.has(key));

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Function registry coverage mismatch vs parity-tested methods: missing=${missing.length}, extra=${extra.length}. ` +
        `Missing sample: [${joinPreview(missing)}]. Extra sample: [${joinPreview(extra)}].`,
    );
  }
}

async function main(): Promise<void> {
  const catalog = buildCatalog();
  await assertParityCoverageInvariant(catalog);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  console.log(`[parity-checking] wrote function registry (${catalog.functions.length}) -> ${outputPath}`);
}

await main();
