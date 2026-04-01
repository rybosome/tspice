import type {
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

  if (obj.angleWrapPi !== undefined) {
    out.angleWrapPi = asBoolean(obj.angleWrapPi, `${label}.angleWrapPi`);
  }
  if (obj.errorShort !== undefined) {
    out.errorShort = asBoolean(obj.errorShort, `${label}.errorShort`);
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

function parseCallStep(value: unknown, label: string): MethodWorkflowStepV3 {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["op", "fn", "in"], label);

  const fn = asString(obj.fn, `${label}.fn`);
  if (!Object.prototype.hasOwnProperty.call(obj, "in")) {
    throw new TypeError(`${label}.in is required for op=call`);
  }

  return {
    op: "call",
    fn,
    in: obj.in,
  };
}

function parseStep(value: unknown, label: string): MethodWorkflowStepV3 {
  const obj = asRecord(value, label);
  const op = asString(obj.op, `${label}.op`);

  if (op === "call") {
    return parseCallStep(obj, label);
  }

  if (op === "spiceCall" || op === "callContract" || op === "withResource") {
    throw new TypeError(
      `${label}.op=${JSON.stringify(op)} is no longer supported; use canonical call steps { op: \"call\", fn, in }`,
    );
  }

  throw new TypeError(
    `${label}.op=${JSON.stringify(op)} is not supported in canonical parity workflows; only op=\"call\" is allowed`,
  );
}

function parseWorkflow(value: unknown, label: string): { steps: MethodWorkflowStepV3[] } {
  const obj = asRecord(value, label);
  ensureKnownKeys(obj, ["steps"], label);

  const stepValues = asArray(obj.steps, `${label}.steps`);
  if (stepValues.length === 0) {
    throw new TypeError(`${label}.steps must be a non-empty array`);
  }

  return {
    steps: stepValues.map((entry, i) => parseStep(entry, `${label}.steps[${i}]`)),
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
  } else {
    const suites = asArray(obj.suites, "methodV3.suites").map((entry, i) =>
      parseMethodSuite(entry, `methodV3.suites[${i}]`),
    );
    if (suites.length === 0) {
      throw new TypeError("methodV3.suites must be a non-empty array");
    }

    method.suites = suites;
  }

  return method;
}
