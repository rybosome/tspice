import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import { normalizeFunctionRegistrySource } from "../src/dsl/functionRegistryNormalize.js";
import { parseFunctionRegistrySource } from "../src/dsl/functionRegistryValidate.js";

import type {
  FunctionRegistryBufferSpec,
  FunctionRegistryCatalog,
  NormalizedFunctionRegistryFunctionSpec,
} from "../src/dsl/functionRegistryTypes.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

const sourcePath = path.resolve(packageRoot, "specs/function-registry/function-registry.yaml");
const contractCatalogPath = path.resolve(packageRoot, "catalogs/contract-methods.json");
const outputPath = path.resolve(packageRoot, "catalogs/function-registry.json");

function readYamlFile(filePath: string): { sourcePath: string; text: string; data: unknown } {
  const text = fs.readFileSync(filePath, "utf8");
  return {
    sourcePath: filePath,
    text,
    data: parseYaml(text),
  };
}

function readContractMethodCatalog(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new TypeError(`Contract method catalog must be a string[] at ${filePath}`);
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new TypeError(`Contract method catalog entry at index ${index} must be a non-empty string`);
    }

    return entry;
  });
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

function canonicalizeFunctionSpec(
  spec: NormalizedFunctionRegistryFunctionSpec,
): NormalizedFunctionRegistryFunctionSpec {
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
    behaviorClass: spec.behaviorClass,
    implemented: spec.implemented,
    ...(spec.executable === undefined
      ? {}
      : {
          executable: {
            ts: {
              method: spec.executable.ts.method,
            },
            native: {
              handler: spec.executable.native.handler,
            },
          },
        }),
    ...(spec.overrideReason === undefined ? {} : { overrideReason: spec.overrideReason }),
  };
}

function joinPreview(values: string[]): string {
  const preview = values.slice(0, 8);
  const suffix = values.length > 8 ? ", ..." : "";
  return `${preview.join(", ")}${suffix}`;
}

function buildCatalog(): { catalog: FunctionRegistryCatalog; diagnostics: { missingKeys: string[]; extraKeys: string[] } } {
  const source = parseFunctionRegistrySource(readYamlFile(sourcePath));
  const contractMethodKeys = readContractMethodCatalog(contractCatalogPath);

  const { catalog, diagnostics } = normalizeFunctionRegistrySource(source, contractMethodKeys);

  const sortedFunctions = [...catalog.functions]
    .sort((a, b) => stableSort(a.key, b.key))
    .map((entry) => canonicalizeFunctionSpec(entry));

  return {
    catalog: {
      dslVersion: catalog.dslVersion,
      functions: sortedFunctions,
    },
    diagnostics,
  };
}

async function main(): Promise<void> {
  const { catalog, diagnostics } = buildCatalog();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  console.log(`[parity-checking] wrote function registry (${catalog.functions.length}) -> ${outputPath}`);

  if (diagnostics.missingKeys.length > 0) {
    console.warn(
      `[parity-checking] function-registry source is missing ${diagnostics.missingKeys.length} contract key(s). ` +
        `Auto-filled with implemented:false defaults. Missing sample: [${joinPreview(diagnostics.missingKeys)}].`,
    );
  }

  if (diagnostics.extraKeys.length > 0) {
    // This should already hard-fail in normalization, but keep a defensive log shape.
    console.warn(
      `[parity-checking] function-registry source has ${diagnostics.extraKeys.length} extra key(s). ` +
        `Extra sample: [${joinPreview(diagnostics.extraKeys)}].`,
    );
  }
}

await main();
