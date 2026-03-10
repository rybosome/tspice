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
  /** Optional for callContract-centric migrated specs. */
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

export type MethodWorkflowSpiceCallNameV3 =
  | "card_c"
  | "size_c"
  | "scard_c"
  | "ssize_c"
  | "valid_c"
  | "dskobj_c"
  | "dsksrf_c"
  | "dskgd_c"
  | "dskb02_c"
  | "dskmi2_c"
  | "dskopn_c"
  | "dskw02_c"
  | "readVirtualOutput";

export type MethodWorkflowOpSpiceCallV3 = {
  op: "spiceCall";
  call: MethodWorkflowSpiceCallNameV3;
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

export type MethodWorkflowOpCallContractV3 = {
  op: "callContract";
  call?: string;
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
  | MethodWorkflowOpSpiceCallV3
  | MethodWorkflowOpCallContractV3
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
