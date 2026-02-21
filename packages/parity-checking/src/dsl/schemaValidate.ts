import type {
  CrossCuttingCaseExpectation,
  CrossCuttingCaseSpec,
  CrossCuttingSpec,
  MethodCaseExpectation,
  MethodCaseSpec,
  MethodSpec,
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
  assertNoUnknownKeys(obj, label, ["ok", "errorShort"]);

  const out: MethodCaseExpectation = {};
  if (obj.ok !== undefined) {
    out.ok = assertBoolean(obj.ok, `${label}.ok`);
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

/** Parse and validate a method YAML document. */
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

/** Parse and validate a cross-cutting YAML document. */
export function parseCrossCuttingSpec(file: ScenarioYamlFile): CrossCuttingSpec {
  const obj = assertRecord(file.data, `${file.sourcePath}`);
  assertNoUnknownKeys(obj, "crossCutting", ["schemaVersion", "kind", "id", "owner", "cases"]);

  const schemaVersion = assertFiniteNumber(obj.schemaVersion, "crossCutting.schemaVersion");
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
