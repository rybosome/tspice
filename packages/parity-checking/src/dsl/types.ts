import type { CompareOptions } from "../compare/types.js";
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

export type MethodResultSpecV2 = {
  type: "object";
  required?: string[];
  properties: Record<string, MethodResultPropertySpecV2>;
};

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
  params: {
    kind: "int";
    size: unknown;
  };
};

export type MethodWorkflowOpSpiceCallV2 = {
  op: "spiceCall";
  call: "card_c" | "size_c";
  in: unknown[];
  as: string;
};

export type MethodWorkflowOpProjectResultV2 = {
  op: "projectResult";
  out: Record<string, unknown>;
};

export type MethodWorkflowOpFreeCellV2 = {
  op: "freeCell";
  target: unknown;
};

export type MethodWorkflowStepV2 =
  | MethodWorkflowOpAllocCellV2
  | MethodWorkflowOpSpiceCallV2
  | MethodWorkflowOpProjectResultV2
  | MethodWorkflowOpFreeCellV2;

export type MethodCaseSpecV2 = {
  id: string;
  args?: Record<string, unknown>;
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

export function isMethodSpecV2(method: AnyMethodSpec): method is MethodSpecV2 {
  return (method as Partial<MethodSpecV2>).schemaVersion === 2;
}

export function methodSpecId(method: AnyMethodSpec): string {
  return isMethodSpecV2(method) ? method.manifest.id : method.id;
}

export function methodCanonicalMethod(method: AnyMethodSpec): string {
  return isMethodSpecV2(method) ? method.contract.canonicalMethod : method.canonicalMethod;
}

export function isCrossCuttingSpecV2(spec: AnyCrossCuttingSpec): spec is CrossCuttingSpecV2 {
  return spec.schemaVersion === 2;
}

export function crossCuttingSpecId(spec: AnyCrossCuttingSpec): string {
  return isCrossCuttingSpecV2(spec) ? spec.manifest.id : spec.id;
}
