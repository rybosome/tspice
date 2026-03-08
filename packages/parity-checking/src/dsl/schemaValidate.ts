import { ASSERT_OPERATORS, type AssertOperator } from "../assertOperators.js";

import type {
  CrossCuttingSpecV3,
  CrossCuttingCaseExpectation,
  CrossCuttingCaseSpec,
  MethodCaseExpectation,
  MethodCaseSpecV3,
  MethodContractV3,
  MethodResultConstValueV3,
  MethodResultObjectSpecV3,
  MethodResultPropertySpecV3,
  MethodResultSpecV3,
  MethodSpecV3,
  MethodSuiteSpecV3,
  MethodWorkflowStepV3,
  ScenarioCompareAst,
  ScenarioSetupAst,
  ScenarioYamlFile,
  WorkflowSpec,
} from "./types.js";

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object (got ${formatValue(value)})`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array (got ${formatValue(value)})`);
  }
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string (got ${formatValue(value)})`);
  }
  return value;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number (got ${formatValue(value)})`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be boolean (got ${formatValue(value)})`);
  }
  return value;
}

function ensureKnownKeys(record: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      const sortedAllowed = [...allowed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      throw new TypeError(
        `${label} has unknown key: ${JSON.stringify(key)} (allowed keys: ${sortedAllowed.map((k) => JSON.stringify(k)).join(", ")})`,
      );
    }
  }
}

function parseCompareAst(value: unknown, label: string): ScenarioCompareAst {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["tolAbs", "tolRel", "angleWrapPi", "errorShort"], label);

  const out: ScenarioCompareAst = {};
  if (obj.tolAbs !== undefined) {
    const n = asFiniteNumber(obj.tolAbs, `${label}.tolAbs`);
    if (n < 0) {
      throw new TypeError(`${label}.tolAbs must be >= 0 (got ${n})`);
    }
    out.tolAbs = n;
  }

  if (obj.tolRel !== undefined) {
    const n = asFiniteNumber(obj.tolRel, `${label}.tolRel`);
    if (n < 0) {
      throw new TypeError(`${label}.tolRel must be >= 0 (got ${n})`);
    }
    out.tolRel = n;
  }

  if (obj.angleWrapPi !== undefined) out.angleWrapPi = asBoolean(obj.angleWrapPi, `${label}.angleWrapPi`);
  if (obj.errorShort !== undefined) out.errorShort = asBoolean(obj.errorShort, `${label}.errorShort`);
  return out;
}

function parseStringMap(value: unknown, label: string): Record<string, string> {
  const obj = asRecord(value, label);
  const out: Record<string, string> = {};

  for (const [key, entry] of Object.entries(obj)) {
    out[key] = asString(entry, `${label}.${key}`);
  }

  return out;
}

function parseKernelEntry(value: unknown, label: string): string | { path: string; restrictToDir?: string } {
  if (typeof value === "string") {
    if (value.trim() === "") {
      throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
  }

  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["path", "restrictToDir"], label);

  const out: { path: string; restrictToDir?: string } = {
    path: asString(obj.path, `${label}.path`),
  };

  if (obj.restrictToDir !== undefined) {
    out.restrictToDir = asString(obj.restrictToDir, `${label}.restrictToDir`);
  }

  return out;
}

function parseSetupAst(value: unknown, label: string): ScenarioSetupAst {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["kernels"], label);

  const out: ScenarioSetupAst = {};
  if (obj.kernels !== undefined) {
    const kernels = asArray(obj.kernels, `${label}.kernels`).map((entry, i) =>
      parseKernelEntry(entry, `${label}.kernels[${i}]`),
    );
    out.kernels = kernels;
  }

  return out;
}

/** Legacy workflow include parser (kept for historical workflow files). */
export function parseWorkflowSpec(file: ScenarioYamlFile): WorkflowSpec {
  const obj = asRecord(file.data, "workflow");
  ensureKnownKeys(obj, ["id", "kind", "uses", "setup", "compareDefaults"], "workflow");

  const id = asString(obj.id, "workflow.id");
  const kind = asString(obj.kind, "workflow.kind");
  if (kind !== "workflow") {
    throw new TypeError(`workflow.kind must be \"workflow\" (got ${JSON.stringify(kind)})`);
  }

  const out: WorkflowSpec = {
    id,
    kind: "workflow",
    meta: { sourcePath: file.sourcePath },
  };

  if (obj.uses !== undefined) {
    out.uses = asArray(obj.uses, "workflow.uses").map((entry, i) =>
      asString(entry, `workflow.uses[${i}]`),
    );
  }

  if (obj.setup !== undefined) {
    out.setup = parseSetupAst(obj.setup, "workflow.setup");
  }

  if (obj.compareDefaults !== undefined) {
    out.compareDefaults = parseCompareAst(obj.compareDefaults, "workflow.compareDefaults");
  }

  return out;
}

function parseMethodCaseExpectation(value: unknown, label: string): MethodCaseExpectation {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["ok", "errorShort", "errorCode"], label);

  const out: MethodCaseExpectation = {};
  if (obj.ok !== undefined) out.ok = asBoolean(obj.ok, `${label}.ok`);
  if (obj.errorShort !== undefined) out.errorShort = asString(obj.errorShort, `${label}.errorShort`);
  if (obj.errorCode !== undefined) out.errorCode = asString(obj.errorCode, `${label}.errorCode`);
  return out;
}

function parseMethodCase(value: unknown, label: string): MethodCaseSpecV3 {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["id", "args", "setup", "compare", "expect"], label);

  const out: MethodCaseSpecV3 = {
    id: asString(obj.id, `${label}.id`),
  };

  if (Object.prototype.hasOwnProperty.call(obj, "args")) {
    out.args = obj.args;
  }
  if (obj.setup !== undefined) out.setup = parseSetupAst(obj.setup, `${label}.setup`);
  if (obj.compare !== undefined) out.compare = parseCompareAst(obj.compare, `${label}.compare`);
  if (obj.expect !== undefined) out.expect = parseMethodCaseExpectation(obj.expect, `${label}.expect`);

  return out;
}

function isMethodResultConstValue(value: unknown): value is MethodResultConstValueV3 {
  if (value === null) return true;

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isMethodResultConstValue(entry));
  }

  if (t === "object") {
    const record = value as Record<string, unknown>;
    return Object.values(record).every((entry) => isMethodResultConstValue(entry));
  }

  return false;
}

function parseMethodResultProperty(value: unknown, label: string): MethodResultPropertySpecV3 {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["const", "type"], label);

  const out: MethodResultPropertySpecV3 = {};
  if (Object.prototype.hasOwnProperty.call(obj, "const")) {
    if (!isMethodResultConstValue(obj.const)) {
      throw new TypeError(`${label}.const must be JSON-serializable`);
    }
    out.const = obj.const;
  }

  if (obj.type !== undefined) {
    const type = asString(obj.type, `${label}.type`);
    if (type !== "spiceInt") {
      throw new TypeError(`${label}.type must be \"spiceInt\" (got ${JSON.stringify(type)})`);
    }
    out.type = "spiceInt";
  }

  if (out.const === undefined && out.type === undefined) {
    throw new TypeError(`${label} must define at least one of { const, type }`);
  }

  return out;
}

function parseMethodResultSpec(value: unknown, label: string): MethodResultSpecV3 {
  const obj = asRecord(value, label);

  if (Object.prototype.hasOwnProperty.call(obj, "const")) {
    ensureKnownKeys(obj, ["const"], label);
    if (!isMethodResultConstValue(obj.const)) {
      throw new TypeError(`${label}.const must be JSON-serializable`);
    }
    return { const: obj.const };
  }

  ensureKnownKeys(obj, ["type", "required", "properties"], label);

  const type = asString(obj.type, `${label}.type`);
  if (type !== "object") {
    throw new TypeError(`${label}.type must be \"object\" (got ${JSON.stringify(type)})`);
  }

  const out: MethodResultObjectSpecV3 = {
    type: "object",
    properties: {},
  };

  if (obj.required !== undefined) {
    out.required = asArray(obj.required, `${label}.required`).map((entry, i) =>
      asString(entry, `${label}.required[${i}]`),
    );
  }

  const propertiesObj = asRecord(obj.properties, `${label}.properties`);
  for (const [prop, propSpec] of Object.entries(propertiesObj)) {
    out.properties[prop] = parseMethodResultProperty(propSpec, `${label}.properties.${prop}`);
  }

  return out;
}

function parseMethodContract(value: unknown, label: string): MethodContractV3 {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["contractMethod", "canonicalMethod", "args", "result", "errors"], label);

  const out: MethodContractV3 = {
    contractMethod: asString(obj.contractMethod, `${label}.contractMethod`),
    canonicalMethod: asString(obj.canonicalMethod, `${label}.canonicalMethod`),
  };

  if (obj.args !== undefined) {
    out.args = asArray(obj.args, `${label}.args`).map((entry, i) => {
      const arg = asRecord(entry, `${label}.args[${i}]`);
      ensureKnownKeys(arg, ["name", "type", "constraints"], `${label}.args[${i}]`);

      const type = asString(arg.type, `${label}.args[${i}].type`);
      if (type !== "spiceInt") {
        throw new TypeError(`${label}.args[${i}].type must be \"spiceInt\"`);
      }

      const parsed: {
        name: string;
        type: "spiceInt";
        constraints?: {
          min?: number;
          max?: number;
        };
      } = {
        name: asString(arg.name, `${label}.args[${i}].name`),
        type: "spiceInt",
      };

      if (arg.constraints !== undefined) {
        const constraints = asRecord(arg.constraints, `${label}.args[${i}].constraints`);
        ensureKnownKeys(constraints, ["min", "max"], `${label}.args[${i}].constraints`);
        parsed.constraints = {};
        if (constraints.min !== undefined) {
          parsed.constraints.min = asFiniteNumber(constraints.min, `${label}.args[${i}].constraints.min`);
        }
        if (constraints.max !== undefined) {
          parsed.constraints.max = asFiniteNumber(constraints.max, `${label}.args[${i}].constraints.max`);
        }
      }

      return parsed;
    });
  }

  if (obj.result !== undefined) {
    out.result = parseMethodResultSpec(obj.result, `${label}.result`);
  }

  if (obj.errors !== undefined) {
    out.errors = asArray(obj.errors, `${label}.errors`).map((entry, i) => {
      const e = asRecord(entry, `${label}.errors[${i}]`);
      ensureKnownKeys(e, ["code"], `${label}.errors[${i}]`);
      return { code: asString(e.code, `${label}.errors[${i}].code`) };
    });
  }

  return out;
}

type LoweredWorkflow = {
  steps: MethodWorkflowStepV3[];
  cleanup: MethodWorkflowStepV3[];
};

function combineLowered(entries: LoweredWorkflow[]): LoweredWorkflow {
  const out: LoweredWorkflow = { steps: [], cleanup: [] };
  for (const entry of entries) {
    out.steps.push(...entry.steps);
    if (entry.cleanup.length > 0) {
      out.cleanup = [...entry.cleanup, ...out.cleanup];
    }
  }
  return out;
}

function parseAssertOperator(test: Record<string, unknown>, label: string): { operator: AssertOperator; operands: [unknown, unknown] } {
  const keys = Object.keys(test);
  if (keys.length !== 1) {
    throw new TypeError(`${label} must define exactly one operator`);
  }

  const operator = keys[0] as AssertOperator;
  if (!ASSERT_OPERATORS.includes(operator)) {
    throw new TypeError(`${label} operator must be one of: ${ASSERT_OPERATORS.join(", ")}`);
  }

  const value = test[operator];
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`${label}.${operator} must be a 2-item array`);
  }

  return {
    operator,
    operands: [value[0], value[1]],
  };
}

function assertScriptSecurity(code: string, label: string): void {
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\bimport\b/, "module imports are not allowed"],
    [/\brequire\s*\(/, "CommonJS require is not allowed"],
    [/\bfrom\s+['"][^'"]+['"]/, "module imports are not allowed"],
    [/\bfs\b/, "direct fs access is not allowed"],
    [/\bhttps?\b/, "network access is not allowed"],
    [/\bnet\b/, "network access is not allowed"],
  ];

  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(code)) {
      throw new TypeError(`${label}.code rejected: ${message}`);
    }
  }
}

function parseStepCore(
  value: unknown,
  label: string,
  options: { allowLifecycleOps: boolean },
): LoweredWorkflow {
  const obj = asRecord(value, label);
  const op = asString(obj.op, `${label}.op`);

  if (op === "withResource") {
    ensureKnownKeys(obj, ["op", "as", "acquire", "steps", "finally"], label);

    const alias = asString(obj.as, `${label}.as`);

    const acquireParsed = parseStepCore(obj.acquire, `${label}.acquire`, { allowLifecycleOps: true });
    if (acquireParsed.steps.length !== 1 || acquireParsed.cleanup.length > 0) {
      throw new TypeError(`${label}.acquire must lower to exactly one concrete step with no intrinsic cleanup`);
    }

    const acquire = acquireParsed.steps[0]!;
    if ("as" in acquire) {
      (acquire as { as: string }).as = alias;
    } else {
      throw new TypeError(`${label}.acquire step must support an \"as\" field`);
    }

    const nestedEntries = asArray(obj.steps, `${label}.steps`).map((entry, i) =>
      parseStepCore(entry, `${label}.steps[${i}]`, { allowLifecycleOps: false }),
    );
    const nested = combineLowered(nestedEntries);

    const finallyEntries = asArray(obj.finally, `${label}.finally`).map((entry, i) =>
      parseStepCore(entry, `${label}.finally[${i}]`, { allowLifecycleOps: true }),
    );
    const finalLowered = combineLowered(finallyEntries);

    return {
      steps: [acquire, ...nested.steps],
      cleanup: [...nested.cleanup, ...finalLowered.steps, ...finalLowered.cleanup],
    };
  }

  if (op === "script") {
    ensureKnownKeys(obj, ["op", "as", "in", "out", "code", "language"], label);

    if (Object.prototype.hasOwnProperty.call(obj, "language")) {
      throw new TypeError(`${label}.language is not supported in v3 (script implies TypeScript)`);
    }

    const code = asString(obj.code, `${label}.code`);
    assertScriptSecurity(code, label);

    const scriptIn = obj.in === undefined ? undefined : asRecord(obj.in, `${label}.in`);
    const scriptOut = obj.out === undefined ? undefined : parseStringMap(obj.out, `${label}.out`);

    return {
      steps: [
        {
          op: "script",
          code,
          ...(scriptIn === undefined ? {} : { in: scriptIn }),
          ...(obj.as === undefined ? {} : { as: asString(obj.as, `${label}.as`) }),
          ...(scriptOut === undefined ? {} : { out: scriptOut }),
        },
      ],
      cleanup: [],
    };
  }

  switch (op) {
    case "allocCell": {
      ensureKnownKeys(obj, ["op", "as", "params"], label);
      const params = asRecord(obj.params, `${label}.params`);
      const kind = asString(params.kind, `${label}.params.kind`);

      if (kind === "int" || kind === "double") {
        ensureKnownKeys(params, ["kind", "size"], `${label}.params`);
        return {
          steps: [
            {
              op: "allocCell",
              as: asString(obj.as, `${label}.as`),
              params: {
                kind,
                size: params.size,
              },
            },
          ],
          cleanup: [],
        };
      }

      if (kind === "char") {
        ensureKnownKeys(params, ["kind", "size", "length"], `${label}.params`);
        return {
          steps: [
            {
              op: "allocCell",
              as: asString(obj.as, `${label}.as`),
              params: {
                kind,
                size: params.size,
                length: params.length,
              },
            },
          ],
          cleanup: [],
        };
      }

      throw new TypeError(`${label}.params.kind must be one of: int, double, char`);
    }

    case "allocWindow": {
      ensureKnownKeys(obj, ["op", "as", "params"], label);
      const params = asRecord(obj.params, `${label}.params`);
      ensureKnownKeys(params, ["maxIntervals"], `${label}.params`);
      return {
        steps: [
          {
            op: "allocWindow",
            as: asString(obj.as, `${label}.as`),
            params: {
              maxIntervals: params.maxIntervals,
            },
          },
        ],
        cleanup: [],
      };
    }

    case "materialize": {
      ensureKnownKeys(obj, ["op", "fixture", "as"], label);
      const fixture = asString(obj.fixture, `${label}.fixture`);
      if (fixture !== "minimalDsk" && fixture !== "virtualOutputSpk") {
        throw new TypeError(`${label}.fixture must be one of: minimalDsk, virtualOutputSpk`);
      }

      return {
        steps: [
          {
            op: "materialize",
            fixture,
            as: asString(obj.as, `${label}.as`),
          },
        ],
        cleanup: [],
      };
    }

    case "call": {
      ensureKnownKeys(obj, ["op", "fn", "in", "as", "out"], label);
      return {
        steps: [
          {
            op: "call",
            fn: asString(obj.fn, `${label}.fn`),
            in: asArray(obj.in, `${label}.in`),
            ...(obj.as !== undefined ? { as: asString(obj.as, `${label}.as`) } : {}),
            ...(obj.out !== undefined ? { out: asRecord(obj.out, `${label}.out`) as Record<string, string> } : {}),
          },
        ],
        cleanup: [],
      };
    }

    case "assert": {
      ensureKnownKeys(obj, ["op", "test", "error"], label);
      const test = asRecord(obj.test, `${label}.test`);
      const { operator, operands } = parseAssertOperator(test, `${label}.test`);
      const error = asRecord(obj.error, `${label}.error`);
      ensureKnownKeys(error, ["code", "message"], `${label}.error`);

      return {
        steps: [
          {
            op: "assert",
            test: {
              [operator]: operands,
            } as MethodWorkflowStepV3 extends { op: "assert"; test: infer T } ? T : never,
            error: {
              code: asString(error.code, `${label}.error.code`),
              message: asString(error.message, `${label}.error.message`),
            },
          },
        ],
        cleanup: [],
      };
    }

    case "projectResult": {
      ensureKnownKeys(obj, ["op", "out"], label);
      return {
        steps: [
          {
            op: "projectResult",
            out: asRecord(obj.out, `${label}.out`),
          },
        ],
        cleanup: [],
      };
    }

    case "project": {
      ensureKnownKeys(obj, ["op", "out"], label);
      return {
        steps: [
          {
            op: "project",
            out: asRecord(obj.out, `${label}.out`),
          },
        ],
        cleanup: [],
      };
    }

    case "switch": {
      ensureKnownKeys(obj, ["op", "on", "cases", "default"], label);
      const casesObj = asRecord(obj.cases, `${label}.cases`);
      const parsedCases: Record<string, MethodWorkflowStepV3[]> = {};

      for (const [caseKey, caseStepsValue] of Object.entries(casesObj)) {
        const caseEntries = asArray(caseStepsValue, `${label}.cases.${caseKey}`);
        const lowered = combineLowered(
          caseEntries.map((entry, i) => parseStepCore(entry, `${label}.cases.${caseKey}[${i}]`, { allowLifecycleOps: false })),
        );
        if (lowered.cleanup.length > 0) {
          throw new TypeError(`${label}.cases.${caseKey} contains withResource cleanup which is not supported inside switch branches`);
        }
        parsedCases[caseKey] = lowered.steps;
      }

      let parsedDefault: MethodWorkflowStepV3[] | undefined;
      if (obj.default !== undefined) {
        const defaultEntries = asArray(obj.default, `${label}.default`);
        const loweredDefault = combineLowered(
          defaultEntries.map((entry, i) => parseStepCore(entry, `${label}.default[${i}]`, { allowLifecycleOps: false })),
        );
        if (loweredDefault.cleanup.length > 0) {
          throw new TypeError(`${label}.default contains withResource cleanup which is not supported inside switch branches`);
        }
        parsedDefault = loweredDefault.steps;
      }

      return {
        steps: [
          {
            op: "switch",
            on: obj.on,
            cases: parsedCases,
            ...(parsedDefault ? { default: parsedDefault } : {}),
          },
        ],
        cleanup: [],
      };
    }

    case "freeCell": {
      ensureKnownKeys(obj, ["op", "target"], label);
      return {
        steps: [
          {
            op: "freeCell",
            target: obj.target,
          },
        ],
        cleanup: [],
      };
    }

    case "freeWindow": {
      ensureKnownKeys(obj, ["op", "target"], label);
      return {
        steps: [
          {
            op: "freeWindow",
            target: obj.target,
          },
        ],
        cleanup: [],
      };
    }

    case "dasOpen":
    case "dlaBeginForwardSearch":
    case "dasClose":
    case "unlink": {
      if (!options.allowLifecycleOps) {
        throw new TypeError(
          `${label}.op=${JSON.stringify(op)} is not allowed in authored v3 workflows; use withResource instead`,
        );
      }

      if (op === "dasOpen") {
        ensureKnownKeys(obj, ["op", "path", "as"], label);
        return {
          steps: [
            {
              op,
              path: obj.path,
              as: asString(obj.as, `${label}.as`),
            },
          ],
          cleanup: [],
        };
      }

      if (op === "dlaBeginForwardSearch") {
        ensureKnownKeys(obj, ["op", "handle", "as"], label);
        return {
          steps: [
            {
              op,
              handle: obj.handle,
              as: asString(obj.as, `${label}.as`),
            },
          ],
          cleanup: [],
        };
      }

      ensureKnownKeys(obj, ["op", "target"], label);
      return {
        steps: [
          {
            op,
            target: obj.target,
          } as Extract<MethodWorkflowStepV3, { op: "dasClose" | "unlink" }>,
        ],
        cleanup: [],
      };
    }

    default:
      throw new TypeError(`Unsupported workflow op: ${JSON.stringify(op)}`);
  }
}

function parseWorkflow(value: unknown, label: string): { steps: MethodWorkflowStepV3[]; cleanup?: MethodWorkflowStepV3[] } {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["steps", "cleanup"], label);

  const stepValues = asArray(obj.steps, `${label}.steps`);
  if (stepValues.length === 0) {
    throw new TypeError(`${label}.steps must be a non-empty array`);
  }

  const loweredBody = combineLowered(
    stepValues.map((entry, i) => parseStepCore(entry, `${label}.steps[${i}]`, { allowLifecycleOps: false })),
  );

  const explicitCleanup = obj.cleanup !== undefined
    ? combineLowered(
        asArray(obj.cleanup, `${label}.cleanup`).map((entry, i) =>
          parseStepCore(entry, `${label}.cleanup[${i}]`, { allowLifecycleOps: false }),
        ),
      )
    : { steps: [] as MethodWorkflowStepV3[], cleanup: [] as MethodWorkflowStepV3[] };

  const cleanup = [
    ...loweredBody.cleanup,
    ...explicitCleanup.steps,
    ...explicitCleanup.cleanup,
  ];

  return {
    steps: loweredBody.steps,
    ...(cleanup.length > 0 ? { cleanup } : {}),
  };
}

function parseMethodSuite(value: unknown, label: string): MethodSuiteSpecV3 {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["id", "setup", "defaults", "workflow", "cases"], label);

  const out: MethodSuiteSpecV3 = {
    id: asString(obj.id, `${label}.id`),
    workflow: parseWorkflow(obj.workflow, `${label}.workflow`),
    cases: asArray(obj.cases, `${label}.cases`).map((entry, i) =>
      parseMethodCase(entry, `${label}.cases[${i}]`),
    ),
  };

  if (obj.setup !== undefined) {
    out.setup = parseSetupAst(obj.setup, `${label}.setup`);
  }

  if (obj.defaults !== undefined) {
    const defaults = asRecord(obj.defaults, `${label}.defaults`);
    ensureKnownKeys(defaults, ["compare"], `${label}.defaults`);
    out.defaults = {};
    if (defaults.compare !== undefined) {
      out.defaults.compare = parseCompareAst(defaults.compare, `${label}.defaults.compare`);
    }
  }

  return out;
}

function assertCaseShapeForWorkflow(
  workflow: { steps: MethodWorkflowStepV3[] },
  cases: MethodCaseSpecV3[],
  label: string,
): void {
  const isSingleCallWorkflow =
    workflow.steps.length === 1 &&
    workflow.steps[0]?.op === "call";

  for (const [index, scenarioCase] of cases.entries()) {
    if (isSingleCallWorkflow) {
      if (scenarioCase.args === undefined) {
        continue;
      }

      const isObjectArgs =
        typeof scenarioCase.args === "object" &&
        scenarioCase.args !== null &&
        !Array.isArray(scenarioCase.args);

      if (!Array.isArray(scenarioCase.args) && !isObjectArgs) {
        throw new TypeError(`${label}[${index}].args must be an array or object when workflow is a single call`);
      }
      continue;
    }

    if (scenarioCase.args === undefined) {
      continue;
    }

    if (typeof scenarioCase.args !== "object" || scenarioCase.args === null || Array.isArray(scenarioCase.args)) {
      throw new TypeError(`${label}[${index}].args must be an object when workflow is not a single call`);
    }
  }
}

/** Parses a methodV3 YAML document into a validated method spec AST. */
export function parseMethodSpec(file: ScenarioYamlFile): MethodSpecV3 {
  const obj = asRecord(file.data, "methodV3");
  ensureKnownKeys(
    obj,
    ["schemaVersion", "manifest", "contract", "setup", "defaults", "workflow", "cases", "suites"],
    "methodV3",
  );

  const schemaVersion = asFiniteNumber(obj.schemaVersion, "methodV3.schemaVersion");
  if (!Number.isInteger(schemaVersion) || schemaVersion !== 3) {
    throw new TypeError(`methodV3.schemaVersion must be 3 (got ${schemaVersion})`);
  }

  const manifest = asRecord(obj.manifest, "methodV3.manifest");
  ensureKnownKeys(manifest, ["id", "kind"], "methodV3.manifest");

  const method: MethodSpecV3 = {
    schemaVersion: 3,
    manifest: {
      id: asString(manifest.id, "methodV3.manifest.id"),
      kind: (() => {
        const kind = asString(manifest.kind, "methodV3.manifest.kind");
        if (kind !== "method") {
          throw new TypeError(`methodV3.manifest.kind must be \"method\" (got ${JSON.stringify(kind)})`);
        }
        return "method" as const;
      })(),
    },
    contract: parseMethodContract(obj.contract, "methodV3.contract"),
    meta: { sourcePath: file.sourcePath },
  };

  if (obj.setup !== undefined) {
    method.setup = parseSetupAst(obj.setup, "methodV3.setup");
  }

  if (obj.defaults !== undefined) {
    const defaults = asRecord(obj.defaults, "methodV3.defaults");
    ensureKnownKeys(defaults, ["compare"], "methodV3.defaults");
    method.defaults = {};
    if (defaults.compare !== undefined) {
      method.defaults.compare = parseCompareAst(defaults.compare, "methodV3.defaults.compare");
    }
  }

  const hasWorkflow = Object.prototype.hasOwnProperty.call(obj, "workflow");
  const hasSuites = Object.prototype.hasOwnProperty.call(obj, "suites");

  if (hasWorkflow === hasSuites) {
    throw new TypeError("methodV3 must define exactly one of workflow/cases or suites[]");
  }

  if (hasWorkflow) {
    if (!Object.prototype.hasOwnProperty.call(obj, "cases")) {
      throw new TypeError("methodV3.cases is required when workflow is defined");
    }

    method.workflow = parseWorkflow(obj.workflow, "methodV3.workflow");
    method.cases = asArray(obj.cases, "methodV3.cases").map((entry, i) =>
      parseMethodCase(entry, `methodV3.cases[${i}]`),
    );

    assertCaseShapeForWorkflow(method.workflow, method.cases, "methodV3.cases");
  } else {
    const suites = asArray(obj.suites, "methodV3.suites").map((entry, i) =>
      parseMethodSuite(entry, `methodV3.suites[${i}]`),
    );
    if (suites.length === 0) {
      throw new TypeError("methodV3.suites must be a non-empty array");
    }

    for (const [index, suite] of suites.entries()) {
      assertCaseShapeForWorkflow(suite.workflow, suite.cases, `methodV3.suites[${index}].cases`);
    }

    method.suites = suites;
  }

  return method;
}

function parseCrossCuttingCaseExpectation(value: unknown, label: string): CrossCuttingCaseExpectation {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["ok", "errorCode"], label);

  return {
    ok: asBoolean(obj.ok, `${label}.ok`),
    ...(obj.errorCode !== undefined ? { errorCode: asString(obj.errorCode, `${label}.errorCode`) } : {}),
  };
}

function parseCrossCuttingCase(value: unknown, label: string): CrossCuttingCaseSpec {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["id", "transport", "rawRequest", "expect"], label);

  const transport = asString(obj.transport, `${label}.transport`);
  if (transport !== "native") {
    throw new TypeError(`${label}.transport must be \"native\" (got ${JSON.stringify(transport)})`);
  }

  return {
    id: asString(obj.id, `${label}.id`),
    transport: "native",
    rawRequest: asString(obj.rawRequest, `${label}.rawRequest`),
    expect: parseCrossCuttingCaseExpectation(obj.expect, `${label}.expect`),
  };
}

/** Parses a crossCuttingV3 YAML document into a validated cross-cutting spec AST. */
export function parseCrossCuttingSpec(file: ScenarioYamlFile): CrossCuttingSpecV3 {
  const obj = asRecord(file.data, "crossCuttingV3");
  ensureKnownKeys(obj, ["schemaVersion", "manifest", "cases"], "crossCuttingV3");

  const schemaVersion = asFiniteNumber(obj.schemaVersion, "crossCuttingV3.schemaVersion");
  if (!Number.isInteger(schemaVersion) || schemaVersion !== 3) {
    throw new TypeError(`crossCuttingV3.schemaVersion must be 3 (got ${schemaVersion})`);
  }

  const manifest = asRecord(obj.manifest, "crossCuttingV3.manifest");
  ensureKnownKeys(manifest, ["id", "kind"], "crossCuttingV3.manifest");

  const kind = asString(manifest.kind, "crossCuttingV3.manifest.kind");
  if (kind !== "crossCuttingSpec") {
    throw new TypeError(`crossCuttingV3.manifest.kind must be \"crossCuttingSpec\" (got ${JSON.stringify(kind)})`);
  }

  return {
    schemaVersion: 3,
    manifest: {
      id: asString(manifest.id, "crossCuttingV3.manifest.id"),
      kind: "crossCuttingSpec",
    },
    cases: asArray(obj.cases, "crossCuttingV3.cases").map((entry, i) =>
      parseCrossCuttingCase(entry, `crossCuttingV3.cases[${i}]`),
    ),
    meta: { sourcePath: file.sourcePath },
  };
}

