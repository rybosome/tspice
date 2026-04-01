import type { CompareOptions } from "../compare/types.js";

/** AST shape for per-scenario compare options in YAML. */
export type ScenarioCompareAst = CompareOptions & {
  errorShort?: boolean;
};

/** AST shape for per-scenario setup (currently just kernel list). */
export type ScenarioSetupAst = {
  kernels?: Array<string | { path: string; restrictToDir?: string }>;
};

/** AST shape for a single scenario case. */
export type ScenarioCaseAst = {
  id: string;
  call: string;
  args?: unknown[];
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  expect?: unknown;
};

/** AST shape for a full scenario document. */
export type ScenarioAst = {
  name?: string;
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  cases: ScenarioCaseAst[];
  meta?: {
    sourcePath?: string;
  };
};

/** Raw YAML file wrapper for validation/parsing. */
export type ScenarioYamlFile = {
  sourcePath: string;
  text?: string;
  data: unknown;
};

export type MethodCaseExpectation = {
  ok?: boolean;
  errorShort?: string;
  errorCode?: string;
};

export type MethodCaseSpecV3 = {
  id: string;
  args?: unknown;
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  expect?: MethodCaseExpectation;
};

export type MethodManifestV3 = {
  id: string;
  kind: "method";
};

export type MethodArgConstraintSpecV3 = {
  min?: number;
  max?: number;
};

export type MethodArgSpecV3 = {
  name: string;
  type: "spiceInt";
  constraints?: MethodArgConstraintSpecV3;
};

export type MethodResultPropertySpecV3 = {
  const?: MethodResultConstValueV3;
  type?: "spiceInt";
};

export type MethodResultConstValueV3 =
  | string
  | number
  | boolean
  | null
  | MethodResultConstValueV3[]
  | { [key: string]: MethodResultConstValueV3 };

export type MethodResultConstSpecV3 = {
  const: MethodResultConstValueV3;
};

export type MethodResultObjectSpecV3 = {
  type: "object";
  required?: string[];
  properties: Record<string, MethodResultPropertySpecV3>;
};

export type MethodResultSpecV3 = MethodResultObjectSpecV3 | MethodResultConstSpecV3;

export type MethodErrorSpecV3 = {
  code: string;
};

export type MethodContractV3 = {
  contractMethod: string;
  canonicalMethod: string;
  args?: MethodArgSpecV3[];
  result?: MethodResultSpecV3;
  errors?: MethodErrorSpecV3[];
};

export type MethodWorkflowOpCallV3 = {
  op: "call";
  fn: string;
  in: unknown;
};

export type MethodWorkflowStepV3 = MethodWorkflowOpCallV3;

export type MethodWorkflowV3 = {
  steps: MethodWorkflowStepV3[];
};

export type MethodSuiteSpecV3 = {
  id: string;
  setup?: ScenarioSetupAst;
  defaults?: {
    compare?: ScenarioCompareAst;
  };
  workflow: MethodWorkflowV3;
  cases: MethodCaseSpecV3[];
};

export type MethodSpecV3 = {
  schemaVersion: 3;
  manifest: MethodManifestV3;
  contract: MethodContractV3;
  setup?: ScenarioSetupAst;
  defaults?: {
    compare?: ScenarioCompareAst;
  };
  workflow?: MethodWorkflowV3;
  cases?: MethodCaseSpecV3[];
  suites?: MethodSuiteSpecV3[];
  meta: {
    sourcePath: string;
  };
};

export type AnyMethodSpec = MethodSpecV3;

export type LoadedParitySpecs = {
  methods: AnyMethodSpec[];
};

// Canonical method spec alias exposed by package API.
export type MethodSpec = MethodSpecV3;

/** Returns a stable method id from canonical `manifest.id`. */
export function methodSpecId(method: AnyMethodSpec): string {
  return method.manifest.id;
}

/** Returns the canonical method name from contract metadata. */
export function methodCanonicalMethod(method: AnyMethodSpec): string {
  return method.contract.canonicalMethod;
}
