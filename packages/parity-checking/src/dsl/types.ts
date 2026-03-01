import type { CompareOptions } from "../compare/types.js";
import type { AssertOperator } from "../assertOperators.js";
import type { KernelEntry } from "../runners/types.js";

export type ScenarioCompareAst = CompareOptions & {
  /** If true, compare only `spice.short` when both sides throw. */
  errorShort?: boolean;
};

export type ScenarioSetupAst = {
  /** Kernel entries (resolved to absolute paths by the parser). */
  kernels?: KernelEntry[];
};

export type ScenarioCaseAst = {
  id: string;
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  call: string;
  args?: unknown[];
  expect?: unknown;
};

export type ScenarioAst = {
  /** Human-readable name. */
  name?: string;
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  cases: ScenarioCaseAst[];
  meta: {
    sourcePath: string;
  };
};

export type ScenarioYamlFile = {
  sourcePath: string;
  text?: string;
  data: unknown;
};

export type WorkflowSpec = {
  id: string;
  kind: "workflow";
  uses?: string[];
  setup?: ScenarioSetupAst;
  compareDefaults?: ScenarioCompareAst;
  notes?: string[];
  meta: {
    sourcePath: string;
  };
};

export type MethodCaseExpectation = {
  ok?: boolean;
  errorCode?: string;
  errorShort?: string;
};

export type MethodCaseSpec = {
  id: string;
  args?: unknown[];
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  expect?: MethodCaseExpectation;
};

export type MethodSpec = {
  id: string;
  kind: "method";
  contractMethod: string;
  canonicalMethod: string;
  uses?: string[];
  setup?: ScenarioSetupAst;
  defaults?: {
    compare?: ScenarioCompareAst;
  };
  cases: MethodCaseSpec[];
  meta: {
    sourcePath: string;
  };
};

export type MethodManifestV2 = {
  id: string;
  kind: "method";
};

export type MethodArgConstraintSpecV2 = {
  min?: number;
  max?: number;
};

export type MethodArgSpecV2 = {
  name: string;
  type: "spiceInt";
  constraints?: MethodArgConstraintSpecV2;
};

export type MethodResultPropertySpecV2 = {
  const?: string | number | boolean | null;
  type?: "spiceInt";
};

export type MethodResultConstValueV2 =
  | string
  | number
  | boolean
  | null
  | MethodResultConstValueV2[]
  | { [key: string]: MethodResultConstValueV2 };

export type MethodResultConstSpecV2 = {
  const: MethodResultConstValueV2;
};

export type MethodResultObjectSpecV2 = {
  type: "object";
  required?: string[];
  properties: Record<string, MethodResultPropertySpecV2>;
};

export type MethodResultSpecV2 = MethodResultObjectSpecV2 | MethodResultConstSpecV2;

export type MethodErrorSpecV2 = {
  code: string;
};

export type MethodContractV2 = {
  contractMethod: string;
  canonicalMethod: string;
  aliases?: string[];
  args?: MethodArgSpecV2[];
  result: MethodResultSpecV2;
  errors?: MethodErrorSpecV2[];
};

export type MethodWorkflowOpAllocCellV2 = {
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

export type MethodWorkflowOpAllocWindowV2 = {
  op: "allocWindow";
  as: string;
  params: {
    maxIntervals: unknown;
  };
};

export type MethodWorkflowSpiceCallNameV2 =
  | "card_c"
  | "size_c"
  | "scard_c"
  | "ssize_c"
  | "valid_c"
  | "dskobj_c"
  | "dsksrf_c"
  | "dskgd_c"
  | "dskb02_c";

export type MethodWorkflowOpSpiceCallV2 = {
  op: "spiceCall";
  call: MethodWorkflowSpiceCallNameV2;
  in: unknown[];
  as?: string;
  out?: Record<string, string>;
};

export type MethodWorkflowOpMaterializeV2 = {
  op: "materialize";
  fixture: "minimalDsk" | "virtualOutputSpk";
  as: string;
};

export type MethodWorkflowOpDasOpenV2 = {
  op: "dasOpen";
  path: unknown;
  as: string;
};

export type MethodWorkflowOpDlaBeginForwardSearchV2 = {
  op: "dlaBeginForwardSearch";
  handle: unknown;
  as: string;
};

export type MethodWorkflowOpDasCloseV2 = {
  op: "dasClose";
  target: unknown;
};

export type MethodWorkflowOpUnlinkV2 = {
  op: "unlink";
  target: unknown;
};

export type MethodWorkflowOpInvokeLegacyCallV2 = {
  op: "invokeLegacyCall";
  call?: string;
};

export type MethodWorkflowAssertOperatorV2 = AssertOperator;

export type MethodWorkflowAssertTestV2 =
  | { eq: [unknown, unknown] }
  | { ne: [unknown, unknown] }
  | { gt: [unknown, unknown] }
  | { gte: [unknown, unknown] }
  | { lt: [unknown, unknown] }
  | { lte: [unknown, unknown] };

export type MethodWorkflowOpAssertV2 = {
  op: "assert";
  test: MethodWorkflowAssertTestV2;
  error: {
    code: string;
    message: string;
  };
};

export type MethodWorkflowOpProjectResultV2 = {
  op: "projectResult";
  out: Record<string, unknown>;
};

export type MethodWorkflowOpProjectV2 = {
  op: "project";
  out: Record<string, unknown>;
};

export type MethodWorkflowOpSwitchV2 = {
  op: "switch";
  on: unknown;
  cases: Record<string, MethodWorkflowStepV2[]>;
  default?: MethodWorkflowStepV2[];
};

export type MethodWorkflowOpFreeCellV2 = {
  op: "freeCell";
  target: unknown;
};

export type MethodWorkflowOpFreeWindowV2 = {
  op: "freeWindow";
  target: unknown;
};

export type MethodWorkflowStepV2 =
  | MethodWorkflowOpAllocCellV2
  | MethodWorkflowOpAllocWindowV2
  | MethodWorkflowOpMaterializeV2
  | MethodWorkflowOpDasOpenV2
  | MethodWorkflowOpDlaBeginForwardSearchV2
  | MethodWorkflowOpDasCloseV2
  | MethodWorkflowOpUnlinkV2
  | MethodWorkflowOpSpiceCallV2
  | MethodWorkflowOpInvokeLegacyCallV2
  | MethodWorkflowOpAssertV2
  | MethodWorkflowOpProjectV2
  | MethodWorkflowOpSwitchV2
  | MethodWorkflowOpProjectResultV2
  | MethodWorkflowOpFreeCellV2
  | MethodWorkflowOpFreeWindowV2;

export type MethodCaseSpecV2 = {
  id: string;
  args?: unknown;
  setup?: ScenarioSetupAst;
  compare?: ScenarioCompareAst;
  expect?: MethodCaseExpectation;
};

export type MethodSpecV2 = {
  schemaVersion: 2;
  manifest: MethodManifestV2;
  contract: MethodContractV2;
  setup?: ScenarioSetupAst;
  defaults?: {
    compare?: ScenarioCompareAst;
  };
  workflow: {
    steps: MethodWorkflowStepV2[];
    cleanup?: MethodWorkflowStepV2[];
  };
  cases: MethodCaseSpecV2[];
  meta: {
    sourcePath: string;
  };
};

export type AnyMethodSpec = MethodSpec | MethodSpecV2;

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

export type CrossCuttingSpec = {
  schemaVersion: 1;
  kind: "crossCuttingSpec";
  id: string;
  owner: string;
  cases: CrossCuttingCaseSpec[];
  meta: {
    sourcePath: string;
  };
};

export type CrossCuttingSpecV2 = {
  schemaVersion: 2;
  manifest: {
    id: string;
    kind: "crossCuttingSpec";
  };
  cases: CrossCuttingCaseSpec[];
  meta: {
    sourcePath: string;
  };
};

export type AnyCrossCuttingSpec = CrossCuttingSpec | CrossCuttingSpecV2;

export type LoadedParitySpecs = {
  workflows: WorkflowSpec[];
  methods: AnyMethodSpec[];
  crossCutting: AnyCrossCuttingSpec[];
};

export type ResolvedMethodSpec = {
  method: MethodSpec;
  includeOrder: WorkflowSpec[];
  mergedSetup?: ScenarioSetupAst;
  mergedCompareDefaults?: ScenarioCompareAst;
};

/** Type guard for schemaVersion=2 method specs. */
export function isMethodSpecV2(method: AnyMethodSpec): method is MethodSpecV2 {
  return (method as Partial<MethodSpecV2>).schemaVersion === 2;
}

/** Return the canonical spec identifier for v1/v2 method specs. */
export function methodSpecId(method: AnyMethodSpec): string {
  return isMethodSpecV2(method) ? method.manifest.id : method.id;
}

/** Return the canonical backend method name for v1/v2 method specs. */
export function methodCanonicalMethod(method: AnyMethodSpec): string {
  return isMethodSpecV2(method) ? method.contract.canonicalMethod : method.canonicalMethod;
}

/** Type guard for schemaVersion=2 cross-cutting specs. */
export function isCrossCuttingSpecV2(spec: AnyCrossCuttingSpec): spec is CrossCuttingSpecV2 {
  return spec.schemaVersion === 2;
}

/** Return the canonical spec identifier for v1/v2 cross-cutting specs. */
export function crossCuttingSpecId(spec: AnyCrossCuttingSpec): string {
  return isCrossCuttingSpecV2(spec) ? spec.manifest.id : spec.id;
}
