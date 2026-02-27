import type {
  AnyCrossCuttingSpec,
  AnyMethodSpec,
  CrossCuttingCaseExpectation,
  CrossCuttingCaseSpec,
  CrossCuttingSpec,
  CrossCuttingSpecV2,
  MethodCaseExpectation,
  MethodCaseSpec,
  MethodCaseSpecV2,
  MethodResultConstValueV2,
  MethodResultObjectSpecV2,
  MethodSpec,
  MethodSpecV2,
  MethodWorkflowStepV2,
  ScenarioCompareAst,
  ScenarioSetupAst,
  ScenarioYamlFile,
  WorkflowSpec,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function assertBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean`);
  }
  return value;
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function assertInteger(value: unknown, label: string): number {
  const n = assertFiniteNumber(value, label);
  if (!Number.isInteger(n)) {
    throw new TypeError(`${label} must be an integer`);
  }
  return n;
}

function assertNoUnknownKeys(obj: Record<string, unknown>, label: string, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      const allowedText = allowedKeys.map((k) => JSON.stringify(k)).join(", ");
      throw new TypeError(
        `${label} has unknown key: ${JSON.stringify(key)} (allowed keys: ${allowedText})`,
      );
    }
  }
}

function parseStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of strings`);
  }
  return value.map((v, i) => assertString(v, `${label}[${i}]`));
}

function parseCompare(value: unknown, label: string): ScenarioCompareAst | undefined {
  if (value === undefined) return undefined;

  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["tolAbs", "tolRel", "angleWrapPi", "errorShort"]);

  const out: ScenarioCompareAst = {};

  if (obj.tolAbs !== undefined) {
    const n = assertFiniteNumber(obj.tolAbs, `${label}.tolAbs`);
    if (n < 0) throw new TypeError(`${label}.tolAbs must be >= 0`);
    out.tolAbs = n;
  }

  if (obj.tolRel !== undefined) {
    const n = assertFiniteNumber(obj.tolRel, `${label}.tolRel`);
    if (n < 0) throw new TypeError(`${label}.tolRel must be >= 0`);
    out.tolRel = n;
  }

  if (obj.angleWrapPi !== undefined) {
    out.angleWrapPi = assertBoolean(obj.angleWrapPi, `${label}.angleWrapPi`);
  }

  if (obj.errorShort !== undefined) {
    out.errorShort = assertBoolean(obj.errorShort, `${label}.errorShort`);
  }

  return Object.keys(out).length === 0 ? undefined : out;
}

function parseKernelEntry(value: unknown, label: string): string | { path: string; restrictToDir?: string } {
  if (typeof value === "string") {
    return value;
  }

  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["path", "restrictToDir"]);
  const pathValue = assertString(obj.path, `${label}.path`);
  const restrictToDir =
    obj.restrictToDir === undefined ? undefined : assertString(obj.restrictToDir, `${label}.restrictToDir`);

  if (restrictToDir === undefined) {
    return { path: pathValue };
  }

  return { path: pathValue, restrictToDir };
}

function parseSetup(value: unknown, label: string): ScenarioSetupAst | undefined {
  if (value === undefined) return undefined;

  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["kernels"]);

  if (obj.kernels === undefined) return undefined;
  if (!Array.isArray(obj.kernels)) {
    throw new TypeError(`${label}.kernels must be an array`);
  }

  const kernels = obj.kernels.map((entry, index) => parseKernelEntry(entry, `${label}.kernels[${index}]`));
  return kernels.length === 0 ? undefined : { kernels };
}

function parseMethodCaseExpectation(value: unknown, label: string): MethodCaseExpectation | undefined {
  if (value === undefined) return undefined;

  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["ok", "errorCode", "errorShort"]);

  const out: MethodCaseExpectation = {};
  if (obj.ok !== undefined) {
    out.ok = assertBoolean(obj.ok, `${label}.ok`);
  }
  if (obj.errorCode !== undefined) {
    out.errorCode = assertString(obj.errorCode, `${label}.errorCode`);
  }
  if (obj.errorShort !== undefined) {
    out.errorShort = assertString(obj.errorShort, `${label}.errorShort`);
  }

  return Object.keys(out).length === 0 ? undefined : out;
}

function parseMethodCase(value: unknown, label: string): MethodCaseSpec {
  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["id", "args", "setup", "compare", "expect"]);

  const out: MethodCaseSpec = {
    id: assertString(obj.id, `${label}.id`),
  };

  if (obj.args !== undefined) {
    if (!Array.isArray(obj.args)) {
      throw new TypeError(`${label}.args must be an array`);
    }
    out.args = obj.args;
  }

  const setup = parseSetup(obj.setup, `${label}.setup`);
  if (setup !== undefined) {
    out.setup = setup;
  }

  const compare = parseCompare(obj.compare, `${label}.compare`);
  if (compare !== undefined) {
    out.compare = compare;
  }

  const expect = parseMethodCaseExpectation(obj.expect, `${label}.expect`);
  if (expect !== undefined) {
    out.expect = expect;
  }

  return out;
}

function parseMethodCaseV2(value: unknown, label: string): MethodCaseSpecV2 {
  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["id", "args", "setup", "compare", "expect"]);

  const out: MethodCaseSpecV2 = {
    id: assertString(obj.id, `${label}.id`),
  };

  if (obj.args !== undefined) {
    out.args = obj.args;
  }

  const setup = parseSetup(obj.setup, `${label}.setup`);
  if (setup !== undefined) {
    out.setup = setup;
  }

  const compare = parseCompare(obj.compare, `${label}.compare`);
  if (compare !== undefined) {
    out.compare = compare;
  }

  const expect = parseMethodCaseExpectation(obj.expect, `${label}.expect`);
  if (expect !== undefined) {
    out.expect = expect;
  }

  return out;
}

function validateInvokeLegacyCallWorkflowShapeV2(
  steps: MethodWorkflowStepV2[],
  cleanup: MethodWorkflowStepV2[] | undefined,
  cases: MethodCaseSpecV2[],
): void {
  const hasInvokeLegacyCallInSteps = steps.some((step) => step.op === "invokeLegacyCall");
  const hasInvokeLegacyCallInCleanup = (cleanup ?? []).some((step) => step.op === "invokeLegacyCall");

  if (hasInvokeLegacyCallInCleanup) {
    throw new TypeError("methodV2.workflow.cleanup must not include invokeLegacyCall");
  }

  if (!hasInvokeLegacyCallInSteps) {
    for (const [index, scenarioCase] of cases.entries()) {
      if (scenarioCase.args !== undefined && !isRecord(scenarioCase.args)) {
        throw new TypeError(
          `methodV2.cases[${index}].args must be an object when workflow does not use invokeLegacyCall`,
        );
      }
    }
    return;
  }

  if (steps.length !== 1 || steps[0]?.op !== "invokeLegacyCall") {
    throw new TypeError("methodV2.workflow.steps must contain only invokeLegacyCall when that op is used");
  }

  if ((cleanup?.length ?? 0) > 0) {
    throw new TypeError("methodV2.workflow.cleanup must be empty when workflow uses invokeLegacyCall");
  }

  for (const [index, scenarioCase] of cases.entries()) {
    if (!Array.isArray(scenarioCase.args)) {
      throw new TypeError(`methodV2.cases[${index}].args must be an array when workflow uses invokeLegacyCall`);
    }
  }
}

/** Parse and validate a workflow YAML document. */
export function parseWorkflowSpec(file: ScenarioYamlFile): WorkflowSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "workflow", ["id", "kind", "uses", "setup", "compareDefaults", "notes"]);

  const id = assertString(obj.id, "workflow.id");
  const kind = assertString(obj.kind, "workflow.kind");
  if (kind !== "workflow") {
    throw new TypeError(`workflow.kind must be \"workflow\" (got ${JSON.stringify(kind)})`);
  }

  const out: WorkflowSpec = {
    id,
    kind: "workflow",
    meta: {
      sourcePath: file.sourcePath,
    },
  };

  const uses = parseStringArray(obj.uses, "workflow.uses");
  if (uses !== undefined) {
    out.uses = uses;
  }

  const setup = parseSetup(obj.setup, "workflow.setup");
  if (setup !== undefined) {
    out.setup = setup;
  }

  const compareDefaults = parseCompare(obj.compareDefaults, "workflow.compareDefaults");
  if (compareDefaults !== undefined) {
    out.compareDefaults = compareDefaults;
  }

  const notes = parseStringArray(obj.notes, "workflow.notes");
  if (notes !== undefined) {
    out.notes = notes;
  }

  return out;
}

/** Parse and validate a legacy (v1) method YAML document. */
export function parseMethodSpec(file: ScenarioYamlFile): MethodSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "method", [
    "id",
    "kind",
    "contractMethod",
    "canonicalMethod",
    "uses",
    "setup",
    "defaults",
    "cases",
  ]);

  const id = assertString(obj.id, "method.id");
  const kind = assertString(obj.kind, "method.kind");
  if (kind !== "method") {
    throw new TypeError(`method.kind must be \"method\" (got ${JSON.stringify(kind)})`);
  }

  if (!Array.isArray(obj.cases) || obj.cases.length === 0) {
    throw new TypeError("method.cases must be a non-empty array");
  }

  const out: MethodSpec = {
    id,
    kind: "method",
    contractMethod: assertString(obj.contractMethod, "method.contractMethod"),
    canonicalMethod: assertString(obj.canonicalMethod, "method.canonicalMethod"),
    cases: obj.cases.map((entry, index) => parseMethodCase(entry, `method.cases[${index}]`)),
    meta: {
      sourcePath: file.sourcePath,
    },
  };

  const uses = parseStringArray(obj.uses, "method.uses");
  if (uses !== undefined) {
    out.uses = uses;
  }

  const setup = parseSetup(obj.setup, "method.setup");
  if (setup !== undefined) {
    out.setup = setup;
  }

  if (obj.defaults !== undefined) {
    const defaultsObj = assertRecord(obj.defaults, "method.defaults");
    assertNoUnknownKeys(defaultsObj, "method.defaults", ["compare"]);

    const defaultsCompare = parseCompare(defaultsObj.compare, "method.defaults.compare");
    if (defaultsCompare !== undefined) {
      out.defaults = {
        compare: defaultsCompare,
      };
    }
  }

  return out;
}

function parseMethodWorkflowStepV2(value: unknown, label: string): MethodWorkflowStepV2 {
  const obj = assertRecord(value, label);

  const op = assertString(obj.op, `${label}.op`);
  switch (op) {
    case "allocCell": {
      assertNoUnknownKeys(obj, label, ["op", "as", "params"]);
      const params = assertRecord(obj.params, `${label}.params`);
      assertNoUnknownKeys(params, `${label}.params`, ["kind", "size", "length"]);
      const kind = assertString(params.kind, `${label}.params.kind`);
      if (!("size" in params)) {
        throw new TypeError(`${label}.params.size is required`);
      }

      if (kind === "int" || kind === "double") {
        if ("length" in params) {
          throw new TypeError(`${label}.params.length is only valid for kind=\"char\"`);
        }

        return {
          op: "allocCell",
          as: assertString(obj.as, `${label}.as`),
          params: {
            kind,
            size: params.size,
          },
        };
      }

      if (kind === "char") {
        if (!("length" in params)) {
          throw new TypeError(`${label}.params.length is required when kind=\"char\"`);
        }

        return {
          op: "allocCell",
          as: assertString(obj.as, `${label}.as`),
          params: {
            kind: "char",
            size: params.size,
            length: params.length,
          },
        };
      }

      throw new TypeError(`${label}.params.kind must be \"int\", \"double\", or \"char\"`);
    }

    case "allocWindow": {
      assertNoUnknownKeys(obj, label, ["op", "as", "params"]);
      const params = assertRecord(obj.params, `${label}.params`);
      assertNoUnknownKeys(params, `${label}.params`, ["maxIntervals"]);
      if (!("maxIntervals" in params)) {
        throw new TypeError(`${label}.params.maxIntervals is required`);
      }

      return {
        op: "allocWindow",
        as: assertString(obj.as, `${label}.as`),
        params: {
          maxIntervals: params.maxIntervals,
        },
      };
    }

    case "spiceCall": {
      assertNoUnknownKeys(obj, label, ["op", "call", "in", "as"]);
      const call = assertString(obj.call, `${label}.call`);
      if (
        call !== "card_c" &&
        call !== "size_c" &&
        call !== "scard_c" &&
        call !== "ssize_c" &&
        call !== "valid_c" &&
        call !== "dskobj_c" &&
        call !== "dsksrf_c" &&
        call !== "dskgd_c" &&
        call !== "dskb02_c" &&
        call !== "ekfind_c" &&
        call !== "ekntab_c" &&
        call !== "ektnam_c" &&
        call !== "eknseg_c" &&
        call !== "ekopn_c" &&
        call !== "ekopr_c" &&
        call !== "ekopw_c" &&
        call !== "ekcls_c" &&
        call !== "ekgc_c" &&
        call !== "ekgd_c" &&
        call !== "ekgi_c" &&
        call !== "dskmi2_c" &&
        call !== "dskopn_c" &&
        call !== "dskw02_c" &&
        call !== "readVirtualOutput"
      ) {
        throw new TypeError(
          `${label}.call must be one of \"card_c\", \"size_c\", \"scard_c\", \"ssize_c\", \"valid_c\", \"dskobj_c\", \"dsksrf_c\", \"dskgd_c\", \"dskb02_c\", \"ekfind_c\", \"ekgc_c\", \"ekgd_c\", \"ekgi_c\", \"ekntab_c\", \"ektnam_c\", \"eknseg_c\", \"ekopn_c\", \"ekopr_c\", \"ekopw_c\", \"ekcls_c\", \"dskmi2_c\", \"dskopn_c\", \"dskw02_c\", or \"readVirtualOutput\"`,
        );
      }
      if (!Array.isArray(obj.in)) {
        throw new TypeError(`${label}.in must be an array`);
      }

      if (
        call === "card_c" ||
        call === "size_c" ||
        call === "dskgd_c" ||
        call === "dskb02_c" ||
        call === "ekfind_c" ||
        call === "ekgc_c" ||
        call === "ekgd_c" ||
        call === "ekgi_c" ||
        call === "ekntab_c" ||
        call === "ektnam_c" ||
        call === "eknseg_c" ||
        call === "ekopn_c" ||
        call === "ekopr_c" ||
        call === "ekopw_c"
      ) {
        if (obj.as === undefined) {
          throw new TypeError(`${label}.as is required when call=${JSON.stringify(call)}`);
        }

        return {
          op: "spiceCall",
          call,
          in: obj.in,
          as: assertString(obj.as, `${label}.as`),
        };
      }

      if (obj.as !== undefined) {
        throw new TypeError(`${label}.as is not allowed when call=${JSON.stringify(call)}`);
      }

      return {
        op: "spiceCall",
        call,
        in: obj.in,
      };
    }

    case "invokeLegacyCall": {
      assertNoUnknownKeys(obj, label, ["op", "call"]);
      return {
        op: "invokeLegacyCall",
        ...(obj.call === undefined ? {} : { call: assertString(obj.call, `${label}.call`) }),
      };
    }

    case "projectResult": {
      assertNoUnknownKeys(obj, label, ["op", "out"]);
      return {
        op: "projectResult",
        out: assertRecord(obj.out, `${label}.out`),
      };
    }

    case "freeCell": {
      assertNoUnknownKeys(obj, label, ["op", "target"]);
      if (!("target" in obj)) {
        throw new TypeError(`${label}.target is required`);
      }
      return {
        op: "freeCell",
        target: obj.target,
      };
    }

    case "freeWindow": {
      assertNoUnknownKeys(obj, label, ["op", "target"]);
      if (!("target" in obj)) {
        throw new TypeError(`${label}.target is required`);
      }
      return {
        op: "freeWindow",
        target: obj.target,
      };
    }

    default:
      throw new TypeError(`${label}.op has unsupported value ${JSON.stringify(op)}`);
  }
}

function parseMethodResultConstValueV2(value: unknown, label: string): MethodResultConstValueV2 {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => parseMethodResultConstValueV2(entry, `${label}[${index}]`));
  }

  const obj = assertRecord(value, label);
  const out: Record<string, MethodResultConstValueV2> = {};
  for (const [key, entry] of Object.entries(obj)) {
    out[key] = parseMethodResultConstValueV2(entry, `${label}.${key}`);
  }
  return out;
}

function parseMethodSpecV2ContractResult(
  value: unknown,
  label: string,
): MethodSpecV2["contract"]["result"] {
  const obj = assertRecord(value, label);

  if (Object.prototype.hasOwnProperty.call(obj, "const")) {
    assertNoUnknownKeys(obj, label, ["const"]);
    return {
      const: parseMethodResultConstValueV2(obj.const, `${label}.const`),
    };
  }

  assertNoUnknownKeys(obj, label, ["type", "required", "properties"]);

  const type = assertString(obj.type, `${label}.type`);
  if (type !== "object") {
    throw new TypeError(`${label}.type must be \"object\"`);
  }

  const required = parseStringArray(obj.required, `${label}.required`);

  const propertiesObj = assertRecord(obj.properties, `${label}.properties`);
  const properties: MethodResultObjectSpecV2["properties"] = {};

  for (const [name, rawProperty] of Object.entries(propertiesObj)) {
    const property = assertRecord(rawProperty, `${label}.properties.${name}`);
    assertNoUnknownKeys(property, `${label}.properties.${name}`, ["const", "type"]);

    if (property.const === undefined && property.type === undefined) {
      throw new TypeError(
        `${label}.properties.${name} must define at least one of \"const\" or \"type\"`,
      );
    }

    const out: MethodResultObjectSpecV2["properties"][string] = {};

    if (property.const !== undefined) {
      const constant = property.const;
      if (
        typeof constant !== "string" &&
        typeof constant !== "number" &&
        typeof constant !== "boolean" &&
        constant !== null
      ) {
        throw new TypeError(
          `${label}.properties.${name}.const must be string|number|boolean|null`,
        );
      }
      out.const = constant;
    }

    if (property.type !== undefined) {
      const propertyType = assertString(property.type, `${label}.properties.${name}.type`);
      if (propertyType !== "spiceInt") {
        throw new TypeError(`${label}.properties.${name}.type must be \"spiceInt\"`);
      }
      out.type = "spiceInt";
    }

    properties[name] = out;
  }

  return {
    type: "object",
    ...(required ? { required } : {}),
    properties,
  };
}

function parseMethodSpecV2Contract(
  value: unknown,
  label: string,
): MethodSpecV2["contract"] {
  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["contractMethod", "canonicalMethod", "aliases", "args", "result", "errors"]);

  const aliases = parseStringArray(obj.aliases, `${label}.aliases`);

  const args =
    obj.args === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(obj.args)) {
            throw new TypeError(`${label}.args must be an array`);
          }
          return obj.args.map((entry, index) => {
            const arg = assertRecord(entry, `${label}.args[${index}]`);
            assertNoUnknownKeys(arg, `${label}.args[${index}]`, ["name", "type", "constraints"]);

            const type = assertString(arg.type, `${label}.args[${index}].type`);
            if (type !== "spiceInt" && type !== "string") {
              throw new TypeError(`${label}.args[${index}].type must be \"spiceInt\" or \"string\"`);
            }

            const name = assertString(arg.name, `${label}.args[${index}].name`);

            if (type === "string") {
              if (arg.constraints !== undefined) {
                throw new TypeError(
                  `${label}.args[${index}].constraints is only allowed when type=\"spiceInt\"`,
                );
              }

              return {
                name,
                type: "string" as const,
              };
            }

            const constraints =
              arg.constraints === undefined
                ? undefined
                : (() => {
                    const parsed = assertRecord(arg.constraints, `${label}.args[${index}].constraints`);
                    assertNoUnknownKeys(parsed, `${label}.args[${index}].constraints`, ["min", "max"]);
                    const min =
                      parsed.min === undefined
                        ? undefined
                        : assertInteger(parsed.min, `${label}.args[${index}].constraints.min`);
                    const max =
                      parsed.max === undefined
                        ? undefined
                        : assertInteger(parsed.max, `${label}.args[${index}].constraints.max`);
                    return {
                      ...(min === undefined ? {} : { min }),
                      ...(max === undefined ? {} : { max }),
                    };
                  })();

            return {
              name,
              type: "spiceInt" as const,
              ...(constraints && Object.keys(constraints).length > 0 ? { constraints } : {}),
            };
          });
        })();

  const errors =
    obj.errors === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(obj.errors)) {
            throw new TypeError(`${label}.errors must be an array`);
          }

          return obj.errors.map((entry, index) => {
            const errorSpec = assertRecord(entry, `${label}.errors[${index}]`);
            assertNoUnknownKeys(errorSpec, `${label}.errors[${index}]`, ["code"]);
            return {
              code: assertString(errorSpec.code, `${label}.errors[${index}].code`),
            };
          });
        })();

  return {
    contractMethod: assertString(obj.contractMethod, `${label}.contractMethod`),
    canonicalMethod: assertString(obj.canonicalMethod, `${label}.canonicalMethod`),
    ...(aliases ? { aliases } : {}),
    ...(args ? { args } : {}),
    result: parseMethodSpecV2ContractResult(obj.result, `${label}.result`),
    ...(errors ? { errors } : {}),
  };
}

/** Parse and validate a v2 method YAML document. */
export function parseMethodSpecV2(file: ScenarioYamlFile): MethodSpecV2 {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "methodV2", [
    "schemaVersion",
    "manifest",
    "contract",
    "setup",
    "defaults",
    "workflow",
    "cases",
  ]);

  const schemaVersion = assertInteger(obj.schemaVersion, "methodV2.schemaVersion");
  if (schemaVersion !== 2) {
    throw new TypeError(`methodV2.schemaVersion must be 2 (got ${schemaVersion})`);
  }

  const manifest = assertRecord(obj.manifest, "methodV2.manifest");
  assertNoUnknownKeys(manifest, "methodV2.manifest", ["id", "kind"]);

  const manifestKind = assertString(manifest.kind, "methodV2.manifest.kind");
  if (manifestKind !== "method") {
    throw new TypeError(`methodV2.manifest.kind must be \"method\" (got ${JSON.stringify(manifestKind)})`);
  }

  const workflowObj = assertRecord(obj.workflow, "methodV2.workflow");
  assertNoUnknownKeys(workflowObj, "methodV2.workflow", ["steps", "cleanup"]);

  if (!Array.isArray(workflowObj.steps) || workflowObj.steps.length === 0) {
    throw new TypeError("methodV2.workflow.steps must be a non-empty array");
  }

  const steps = workflowObj.steps.map((entry, index) =>
    parseMethodWorkflowStepV2(entry, `methodV2.workflow.steps[${index}]`),
  );

  const cleanup =
    workflowObj.cleanup === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(workflowObj.cleanup)) {
            throw new TypeError("methodV2.workflow.cleanup must be an array");
          }
          return workflowObj.cleanup.map((entry, index) =>
            parseMethodWorkflowStepV2(entry, `methodV2.workflow.cleanup[${index}]`),
          );
        })();

  if (!Array.isArray(obj.cases) || obj.cases.length === 0) {
    throw new TypeError("methodV2.cases must be a non-empty array");
  }

  const cases = obj.cases.map((entry, index) => parseMethodCaseV2(entry, `methodV2.cases[${index}]`));
  validateInvokeLegacyCallWorkflowShapeV2(steps, cleanup, cases);

  const out: MethodSpecV2 = {
    schemaVersion: 2,
    manifest: {
      id: assertString(manifest.id, "methodV2.manifest.id"),
      kind: "method",
    },
    contract: parseMethodSpecV2Contract(obj.contract, "methodV2.contract"),
    workflow: {
      steps,
      ...(cleanup ? { cleanup } : {}),
    },
    cases,
    meta: {
      sourcePath: file.sourcePath,
    },
  };

  const setup = parseSetup(obj.setup, "methodV2.setup");
  if (setup !== undefined) {
    out.setup = setup;
  }

  if (obj.defaults !== undefined) {
    const defaultsObj = assertRecord(obj.defaults, "methodV2.defaults");
    assertNoUnknownKeys(defaultsObj, "methodV2.defaults", ["compare"]);

    const defaultsCompare = parseCompare(defaultsObj.compare, "methodV2.defaults.compare");
    if (defaultsCompare !== undefined) {
      out.defaults = {
        compare: defaultsCompare,
      };
    }
  }

  return out;
}

/** Parse and validate either a v1 (legacy) or v2 method YAML document. */
export function parseMethodSpecAny(file: ScenarioYamlFile): AnyMethodSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);

  if (obj.schemaVersion === undefined) {
    return parseMethodSpec(file);
  }

  const schemaVersion = assertInteger(obj.schemaVersion, "method.schemaVersion");
  if (schemaVersion === 2) {
    return parseMethodSpecV2(file);
  }

  if (schemaVersion === 1) {
    // Back-compat: allow schemaVersion: 1 on legacy shape.
    const { schemaVersion: _ignored, ...legacy } = obj;
    return parseMethodSpec({
      ...file,
      data: legacy,
    });
  }

  throw new TypeError(`method.schemaVersion must be 1 or 2 (got ${schemaVersion})`);
}

function parseCrossCuttingExpectation(value: unknown, label: string): CrossCuttingCaseExpectation {
  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["ok", "errorCode"]);

  const out: CrossCuttingCaseExpectation = {
    ok: assertBoolean(obj.ok, `${label}.ok`),
  };

  if (obj.errorCode !== undefined) {
    out.errorCode = assertString(obj.errorCode, `${label}.errorCode`);
  }

  return out;
}

function parseCrossCuttingCase(value: unknown, label: string): CrossCuttingCaseSpec {
  const obj = assertRecord(value, label);
  assertNoUnknownKeys(obj, label, ["id", "transport", "rawRequest", "expect"]);

  const transport = assertString(obj.transport, `${label}.transport`);
  if (transport !== "native") {
    throw new TypeError(`${label}.transport must be \"native\"`);
  }

  return {
    id: assertString(obj.id, `${label}.id`),
    transport: "native",
    rawRequest: assertString(obj.rawRequest, `${label}.rawRequest`),
    expect: parseCrossCuttingExpectation(obj.expect, `${label}.expect`),
  };
}

/** Parse and validate a v1 cross-cutting YAML document. */
export function parseCrossCuttingSpec(file: ScenarioYamlFile): CrossCuttingSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "crossCutting", ["schemaVersion", "kind", "id", "owner", "cases"]);

  const schemaVersion = assertInteger(obj.schemaVersion, "crossCutting.schemaVersion");
  if (schemaVersion !== 1) {
    throw new TypeError(`crossCutting.schemaVersion must be 1 (got ${schemaVersion})`);
  }

  const kind = assertString(obj.kind, "crossCutting.kind");
  if (kind !== "crossCuttingSpec") {
    throw new TypeError(`crossCutting.kind must be \"crossCuttingSpec\" (got ${JSON.stringify(kind)})`);
  }

  if (!Array.isArray(obj.cases) || obj.cases.length === 0) {
    throw new TypeError("crossCutting.cases must be a non-empty array");
  }

  return {
    schemaVersion: 1,
    kind: "crossCuttingSpec",
    id: assertString(obj.id, "crossCutting.id"),
    owner: assertString(obj.owner, "crossCutting.owner"),
    cases: obj.cases.map((entry, index) => parseCrossCuttingCase(entry, `crossCutting.cases[${index}]`)),
    meta: {
      sourcePath: file.sourcePath,
    },
  };
}

/** Parse and validate a v2 cross-cutting YAML document. */
export function parseCrossCuttingSpecV2(file: ScenarioYamlFile): CrossCuttingSpecV2 {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "crossCuttingV2", ["schemaVersion", "manifest", "cases"]);

  const schemaVersion = assertInteger(obj.schemaVersion, "crossCuttingV2.schemaVersion");
  if (schemaVersion !== 2) {
    throw new TypeError(`crossCuttingV2.schemaVersion must be 2 (got ${schemaVersion})`);
  }

  const manifest = assertRecord(obj.manifest, "crossCuttingV2.manifest");
  assertNoUnknownKeys(manifest, "crossCuttingV2.manifest", ["id", "kind"]);

  const kind = assertString(manifest.kind, "crossCuttingV2.manifest.kind");
  if (kind !== "crossCuttingSpec") {
    throw new TypeError(
      `crossCuttingV2.manifest.kind must be \"crossCuttingSpec\" (got ${JSON.stringify(kind)})`,
    );
  }

  if (!Array.isArray(obj.cases) || obj.cases.length === 0) {
    throw new TypeError("crossCuttingV2.cases must be a non-empty array");
  }

  return {
    schemaVersion: 2,
    manifest: {
      id: assertString(manifest.id, "crossCuttingV2.manifest.id"),
      kind: "crossCuttingSpec",
    },
    cases: obj.cases.map((entry, index) => parseCrossCuttingCase(entry, `crossCuttingV2.cases[${index}]`)),
    meta: {
      sourcePath: file.sourcePath,
    },
  };
}

/** Parse and validate either a v1 or v2 cross-cutting YAML document. */
export function parseCrossCuttingSpecAny(file: ScenarioYamlFile): AnyCrossCuttingSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);

  const schemaVersion = assertInteger(obj.schemaVersion, "crossCutting.schemaVersion");
  if (schemaVersion === 1) {
    return parseCrossCuttingSpec(file);
  }
  if (schemaVersion === 2) {
    return parseCrossCuttingSpecV2(file);
  }

  throw new TypeError(`crossCutting.schemaVersion must be 1 or 2 (got ${schemaVersion})`);
}
