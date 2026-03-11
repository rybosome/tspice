import type { CompareOptions } from "../compare/types.js";
import type { AssertOperator } from "../assertOperators.js";

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

/** Legacy reusable workflow spec referenced by `uses` includes. */
export type WorkflowSpec = {
  id: string;
  kind: "workflow";
  uses?: string[];
  setup?: ScenarioSetupAst;
  compareDefaults?: ScenarioCompareAst;
  meta: {
    sourcePath: string;
  };
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
  /** Optional for methods that return scalar or ad-hoc object values. */
  result?: MethodResultSpecV3;
  errors?: MethodErrorSpecV3[];
};

export type MethodWorkflowOpAllocCellV3 = {
  op: "allocCell";
  as: string;
  params:
    | {
        kind: "int" | "double";
        size: unknown;
      }
    | {
        kind: "char";
        size: unknown;
        length: unknown;
      };
};

export type MethodWorkflowOpAllocWindowV3 = {
  op: "allocWindow";
  as: string;
  params: {
    maxIntervals: unknown;
  };
};

export type MethodWorkflowOpCallV3 = {
  op: "call";
  call?: string;
  /** @deprecated use `call` */
  fn?: string;
  in: unknown[];
  as?: string;
  out?: Record<string, string>;
};

export type MethodWorkflowOpMaterializeV3 = {
  op: "materialize";
  fixture: "minimalDsk" | "virtualOutputSpk";
  as: string;
};

export type MethodWorkflowOpDasOpenV3 = {
  op: "dasOpen";
  path: unknown;
  as: string;
};

export type MethodWorkflowOpDlaBeginForwardSearchV3 = {
  op: "dlaBeginForwardSearch";
  handle: unknown;
  as: string;
};

export type MethodWorkflowOpDasCloseV3 = {
  op: "dasClose";
  target: unknown;
};

export type MethodWorkflowOpUnlinkV3 = {
  op: "unlink";
  target: unknown;
};

export type MethodWorkflowOpScriptV3 = {
  op: "script";
  code: string;
  in?: Record<string, unknown>;
  as?: string;
  out?: Record<string, string>;
};

export type MethodWorkflowAssertOperatorV3 = AssertOperator;

export type MethodWorkflowAssertTestV3 =
  | { eq: [unknown, unknown] }
  | { ne: [unknown, unknown] }
  | { gt: [unknown, unknown] }
  | { gte: [unknown, unknown] }
  | { lt: [unknown, unknown] }
  | { lte: [unknown, unknown] };

export type MethodWorkflowOpAssertV3 = {
  op: "assert";
  test: MethodWorkflowAssertTestV3;
  error: {
    code: string;
    message: string;
  };
};

export type MethodWorkflowOpProjectResultV3 = {
  op: "projectResult";
  out: Record<string, unknown>;
};

export type MethodWorkflowOpProjectV3 = {
  op: "project";
  out: Record<string, unknown>;
};

export type MethodWorkflowOpSwitchV3 = {
  op: "switch";
  on: unknown;
  cases: Record<string, MethodWorkflowStepV3[]>;
  default?: MethodWorkflowStepV3[];
};

export type MethodWorkflowOpFreeCellV3 = {
  op: "freeCell";
  target: unknown;
};

export type MethodWorkflowOpFreeWindowV3 = {
  op: "freeWindow";
  target: unknown;
};

export type MethodWorkflowStepV3 =
  | MethodWorkflowOpAllocCellV3
  | MethodWorkflowOpAllocWindowV3
  | MethodWorkflowOpMaterializeV3
  | MethodWorkflowOpDasOpenV3
  | MethodWorkflowOpDlaBeginForwardSearchV3
  | MethodWorkflowOpDasCloseV3
  | MethodWorkflowOpUnlinkV3
  | MethodWorkflowOpCallV3
  | MethodWorkflowOpScriptV3
  | MethodWorkflowOpAssertV3
  | MethodWorkflowOpProjectV3
  | MethodWorkflowOpSwitchV3
  | MethodWorkflowOpProjectResultV3
  | MethodWorkflowOpFreeCellV3
  | MethodWorkflowOpFreeWindowV3;

export type MethodWorkflowV3 = {
  steps: MethodWorkflowStepV3[];
  cleanup?: MethodWorkflowStepV3[];
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
  uses?: string[];
  workflow?: MethodWorkflowV3;
  cases?: MethodCaseSpecV3[];
  suites?: MethodSuiteSpecV3[];
  meta: {
    sourcePath: string;
  };
};

export type AnyMethodSpec = MethodSpecV3;

export type CrossCuttingCaseExpectation = {
  ok: boolean;
  errorCode?: string;
};

export type CrossCuttingCaseSpec = {
  id: string;
  transport: "native";
  rawRequest: string;
  expect: CrossCuttingCaseExpectation;
};

export type CrossCuttingSpecV3 = {
  schemaVersion: 3;
  manifest: {
    id: string;
    kind: "crossCuttingSpec";
  };
  cases: CrossCuttingCaseSpec[];
  meta: {
    sourcePath: string;
  };
};

export type AnyCrossCuttingSpec = CrossCuttingSpecV3;

export type LoadedParitySpecs = {
  workflows: WorkflowSpec[];
  methods: AnyMethodSpec[];
};

export type ResolvedMethodSpec = {
  method: MethodSpecV3;
  includeOrder: WorkflowSpec[];
  mergedSetup?: ScenarioSetupAst;
  mergedCompareDefaults?: ScenarioCompareAst;
};

// Backward-compatible aliases (to ease rename churn while code moves to v3 names).
export type MethodSpec = MethodSpecV3;
export type MethodManifestV2 = MethodManifestV3;
export type MethodArgConstraintSpecV2 = MethodArgConstraintSpecV3;
export type MethodArgSpecV2 = MethodArgSpecV3;
export type MethodResultPropertySpecV2 = MethodResultPropertySpecV3;
export type MethodResultConstValueV2 = MethodResultConstValueV3;
export type MethodResultConstSpecV2 = MethodResultConstSpecV3;
export type MethodResultObjectSpecV2 = MethodResultObjectSpecV3;
export type MethodResultSpecV2 = MethodResultSpecV3;
export type MethodErrorSpecV2 = MethodErrorSpecV3;
export type MethodContractV2 = MethodContractV3;
export type MethodWorkflowOpAllocCellV2 = MethodWorkflowOpAllocCellV3;
export type MethodWorkflowOpAllocWindowV2 = MethodWorkflowOpAllocWindowV3;
export type MethodWorkflowOpCallV2 = MethodWorkflowOpCallV3;
export type MethodWorkflowOpMaterializeV2 = MethodWorkflowOpMaterializeV3;
export type MethodWorkflowOpDasOpenV2 = MethodWorkflowOpDasOpenV3;
export type MethodWorkflowOpDlaBeginForwardSearchV2 = MethodWorkflowOpDlaBeginForwardSearchV3;
export type MethodWorkflowOpDasCloseV2 = MethodWorkflowOpDasCloseV3;
export type MethodWorkflowOpUnlinkV2 = MethodWorkflowOpUnlinkV3;
export type MethodWorkflowOpScriptV2 = MethodWorkflowOpScriptV3;
export type MethodWorkflowAssertOperatorV2 = MethodWorkflowAssertOperatorV3;
export type MethodWorkflowAssertTestV2 = MethodWorkflowAssertTestV3;
export type MethodWorkflowOpAssertV2 = MethodWorkflowOpAssertV3;
export type MethodWorkflowOpProjectResultV2 = MethodWorkflowOpProjectResultV3;
export type MethodWorkflowOpProjectV2 = MethodWorkflowOpProjectV3;
export type MethodWorkflowOpSwitchV2 = MethodWorkflowOpSwitchV3;
export type MethodWorkflowOpFreeCellV2 = MethodWorkflowOpFreeCellV3;
export type MethodWorkflowOpFreeWindowV2 = MethodWorkflowOpFreeWindowV3;
export type MethodWorkflowStepV2 = MethodWorkflowStepV3;
export type MethodCaseSpecV2 = MethodCaseSpecV3;
export type MethodSpecV2 = MethodSpecV3;
export type CrossCuttingSpec = CrossCuttingSpecV3;
export type CrossCuttingSpecV2 = CrossCuttingSpecV3;

/** Compatibility type guard while v2 references still exist (all method specs are v3). */
export function isMethodSpecV2(_method: AnyMethodSpec): _method is MethodSpecV3 {
  return true;
}

/** Returns a stable method id from v3 `manifest.id` or legacy top-level `id`. */
export function methodSpecId(method: AnyMethodSpec): string {
  const legacy = method as unknown as { id?: string; manifest?: { id?: string } };
  return legacy.manifest?.id ?? legacy.id ?? "unknown-method";
}

/** Returns the canonical method name from v3 contract metadata or legacy shape. */
export function methodCanonicalMethod(method: AnyMethodSpec): string {
  const legacy = method as unknown as {
    canonicalMethod?: string;
    contract?: { canonicalMethod?: string };
  };
  return legacy.contract?.canonicalMethod ?? legacy.canonicalMethod ?? "";
}

/** Compatibility type guard while v2 references still exist (all cross-cutting specs are v3). */
export function isCrossCuttingSpecV2(_spec: AnyCrossCuttingSpec): _spec is CrossCuttingSpecV3 {
  return true;
}

/** Returns a stable cross-cutting spec id from v3 `manifest.id` or legacy top-level `id`. */
export function crossCuttingSpecId(spec: AnyCrossCuttingSpec): string {
  const legacy = spec as unknown as { id?: string; manifest?: { id?: string } };
  return legacy.manifest?.id ?? legacy.id ?? "unknown-cross-cutting";
}
