import {
  classifyFunctionRegistryBehaviorClass,
  isBehaviorClassCompatibleWithShape,
} from "./functionRegistryBehaviorClass.js";

import type {
  FunctionRegistryCatalog,
  FunctionRegistryFunctionSpec,
  FunctionRegistryNormalizationDiagnostics,
  FunctionRegistrySource,
  NormalizedFunctionRegistryFunctionSpec,
} from "./functionRegistryTypes.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function joinPreview(values: string[]): string {
  const preview = values.slice(0, 8);
  const suffix = values.length > 8 ? ", ..." : "";
  return `${preview.join(", ")}${suffix}`;
}

function cloneNormalizedFunctionSpec(spec: NormalizedFunctionRegistryFunctionSpec): NormalizedFunctionRegistryFunctionSpec {
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
            Object.entries(spec.buffers).map(([name, bufferSpec]) => [
              name,
              "bytes" in bufferSpec
                ? {
                    bytes: { ...bufferSpec.bytes },
                    ...(bufferSpec.elementType === undefined
                      ? {}
                      : {
                          elementType: bufferSpec.elementType,
                        }),
                  }
                : {
                    lengthFrom: bufferSpec.lengthFrom,
                    ...(bufferSpec.elementType === undefined
                      ? {}
                      : {
                          elementType: bufferSpec.elementType,
                        }),
                  },
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

function normalizeFunction(
  sourceFunction: FunctionRegistryFunctionSpec,
  label: string,
): NormalizedFunctionRegistryFunctionSpec {
  const inferredBehaviorClass = classifyFunctionRegistryBehaviorClass(sourceFunction);
  const resolvedBehaviorClass = sourceFunction.behaviorClass ?? inferredBehaviorClass;

  if (!isBehaviorClassCompatibleWithShape(resolvedBehaviorClass, sourceFunction)) {
    throw new TypeError(
      `${label}.behaviorClass=${JSON.stringify(resolvedBehaviorClass)} is incompatible with function shape`,
    );
  }

  const isOverride =
    sourceFunction.behaviorClass !== undefined && sourceFunction.behaviorClass !== inferredBehaviorClass;

  if (isOverride && sourceFunction.overrideReason === undefined) {
    throw new TypeError(
      `${label}.behaviorClass override requires overrideReason (default=${JSON.stringify(inferredBehaviorClass)}, explicit=${JSON.stringify(sourceFunction.behaviorClass)})`,
    );
  }

  if (!isOverride && sourceFunction.overrideReason !== undefined) {
    throw new TypeError(
      `${label}.overrideReason is only allowed when behaviorClass overrides the code-owned default ${JSON.stringify(inferredBehaviorClass)}`,
    );
  }

  const implemented = sourceFunction.implemented ?? false;

  if (implemented && sourceFunction.executable === undefined) {
    throw new TypeError(
      `${label}.implemented=true requires executable.ts.method and executable.native.handler metadata`,
    );
  }

  if (!implemented && sourceFunction.executable !== undefined) {
    throw new TypeError(
      `${label}.implemented=false must not define executable metadata (set implemented: true to enable callable dispatch)`,
    );
  }

  const normalized: NormalizedFunctionRegistryFunctionSpec = {
    key: sourceFunction.key,
    input: [...sourceFunction.input],
    ...(sourceFunction.output === undefined ? {} : { output: sourceFunction.output }),
    ...(sourceFunction.buffers === undefined ? {} : { buffers: sourceFunction.buffers }),
    behaviorClass: resolvedBehaviorClass,
    implemented,
    ...(sourceFunction.executable === undefined ? {} : { executable: sourceFunction.executable }),
    ...(isOverride && sourceFunction.overrideReason !== undefined
      ? { overrideReason: sourceFunction.overrideReason }
      : {}),
  };

  return cloneNormalizedFunctionSpec(normalized);
}

function validateContractCatalogKeys(keys: string[]): string[] {
  if (keys.length === 0) {
    throw new TypeError("contract-methods catalog must be a non-empty array");
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  keys.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new TypeError(`contract-methods catalog entry at index ${index} must be a non-empty string`);
    }

    if (seen.has(entry)) {
      throw new TypeError(`contract-methods catalog contains duplicate key ${JSON.stringify(entry)}`);
    }

    seen.add(entry);
    normalized.push(entry);
  });

  return normalized.sort((a, b) => stableSort(a, b));
}

/**
 * Build a normalized function-registry catalog from source DSL + contract key inventory.
 */
export function normalizeFunctionRegistrySource(
  source: FunctionRegistrySource,
  contractMethodKeysInput: string[],
): { catalog: FunctionRegistryCatalog; diagnostics: FunctionRegistryNormalizationDiagnostics } {
  const contractMethodKeys = validateContractCatalogKeys(contractMethodKeysInput);

  const sourceByKey = new Map<string, FunctionRegistryFunctionSpec>();
  for (const [index, fn] of source.functions.entries()) {
    if (sourceByKey.has(fn.key)) {
      throw new TypeError(
        `functionRegistrySource.functions has duplicate key ${JSON.stringify(fn.key)} at index ${index}`,
      );
    }
    sourceByKey.set(fn.key, fn);
  }

  const contractSet = new Set(contractMethodKeys);
  const sourceKeysSorted = [...sourceByKey.keys()].sort((a, b) => stableSort(a, b));

  const missingKeys = contractMethodKeys.filter((key) => !sourceByKey.has(key));
  const extraKeys = sourceKeysSorted.filter((key) => !contractSet.has(key));

  if (extraKeys.length > 0) {
    throw new Error(
      `function-registry source includes keys not present in catalogs/contract-methods.json (extra=${extraKeys.length}). ` +
        `Extra sample: [${joinPreview(extraKeys)}]. Remove unknown keys or add them to backend-contract first.`,
    );
  }

  const functions = contractMethodKeys.map((contractKey, index) => {
    const sourceFunction = sourceByKey.get(contractKey) ?? {
      key: contractKey,
      input: [],
    };

    return normalizeFunction(sourceFunction, `functionRegistrySource.functions[${index}]<${contractKey}>`);
  });

  return {
    catalog: {
      dslVersion: source.dslVersion,
      functions,
    },
    diagnostics: {
      missingKeys,
      extraKeys,
    },
  };
}
