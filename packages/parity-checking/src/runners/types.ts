import type { AssertOperator } from "../assertOperators.js";

export type KernelEntry = string | { path: string; restrictToDir?: string };

export type CaseSetup = {
  kernels?: KernelEntry[];
};

export type RunCaseInputLegacy = {
  setup?: CaseSetup;
  call: string;
  args: unknown[];
};

export type V3ContractArgSpec = {
  name: string;
  type: "spiceInt";
  constraints?: {
    min?: number;
    max?: number;
  };
};

export type V3ContractResultProperty = {
  const?: V3ContractResultConstValue;
  type?: "spiceInt";
};

export type V3ContractResultConstValue =
  | string
  | number
  | boolean
  | null
  | V3ContractResultConstValue[]
  | { [key: string]: V3ContractResultConstValue };

export type V3ContractResultConstSpec = {
  const: V3ContractResultConstValue;
};

export type V3ContractResultObjectSpec = {
  type: "object";
  required?: string[];
  properties: Record<string, V3ContractResultProperty>;
};

export type V3ContractResultSpec = V3ContractResultObjectSpec | V3ContractResultConstSpec;

export type V3ContractSpec = {
  contractMethod: string;
  canonicalMethod: string;
  aliases?: string[];
  args?: V3ContractArgSpec[];
  /** Optional for callContract-first specs migrated from v1. */
  result?: V3ContractResultSpec;
  errors?: Array<{ code: string }>;
};

export type V3WorkflowAllocCellStep = {
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

export type V3WorkflowAllocWindowStep = {
  op: "allocWindow";
  as: string;
  params: {
    maxIntervals: unknown;
  };
};

export type V3WorkflowSpiceCallName =
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

export type V3WorkflowSpiceCallStep = {
  op: "spiceCall";
  call: V3WorkflowSpiceCallName;
  in: unknown[];
  as?: string;
  out?: Record<string, string>;
};

export type V3WorkflowMaterializeFixture = "minimalDsk" | "virtualOutputSpk";

export type V3WorkflowMaterializeStep = {
  op: "materialize";
  fixture: V3WorkflowMaterializeFixture;
  as: string;
};

export type V3WorkflowDasOpenStep = {
  op: "dasOpen";
  path: unknown;
  as: string;
};

export type V3WorkflowDlaBeginForwardSearchStep = {
  op: "dlaBeginForwardSearch";
  handle: unknown;
  as: string;
};

export type V3WorkflowDasCloseStep = {
  op: "dasClose";
  target: unknown;
};

export type V3WorkflowUnlinkStep = {
  op: "unlink";
  target: unknown;
};

export type V3WorkflowCallContractStep = {
  op: "callContract";
  call?: string;
};

export type V3WorkflowScriptStep = {
  op: "script";
  code: string;
  in?: Record<string, unknown>;
  as?: string;
  out?: Record<string, string>;
};

export type V3WorkflowAssertOperator = AssertOperator;

export type V3WorkflowAssertTest =
  | { eq: [unknown, unknown] }
  | { ne: [unknown, unknown] }
  | { gt: [unknown, unknown] }
  | { gte: [unknown, unknown] }
  | { lt: [unknown, unknown] }
  | { lte: [unknown, unknown] };

export type V3WorkflowAssertStep = {
  op: "assert";
  test: V3WorkflowAssertTest;
  error: {
    code: string;
    message: string;
  };
};

export type V3WorkflowProjectResultStep = {
  op: "projectResult";
  out: Record<string, unknown>;
};

export type V3WorkflowProjectStep = {
  op: "project";
  out: Record<string, unknown>;
};

export type V3WorkflowSwitchStep = {
  op: "switch";
  on: unknown;
  cases: Record<string, V3WorkflowStep[]>;
  default?: V3WorkflowStep[];
};

export type V3WorkflowFreeCellStep = {
  op: "freeCell";
  target: unknown;
};

export type V3WorkflowFreeWindowStep = {
  op: "freeWindow";
  target: unknown;
};

export type V3WorkflowStep =
  | V3WorkflowAllocCellStep
  | V3WorkflowAllocWindowStep
  | V3WorkflowMaterializeStep
  | V3WorkflowDasOpenStep
  | V3WorkflowDlaBeginForwardSearchStep
  | V3WorkflowDasCloseStep
  | V3WorkflowUnlinkStep
  | V3WorkflowSpiceCallStep
  | V3WorkflowCallContractStep
  | V3WorkflowScriptStep
  | V3WorkflowAssertStep
  | V3WorkflowProjectStep
  | V3WorkflowSwitchStep
  | V3WorkflowProjectResultStep
  | V3WorkflowFreeCellStep
  | V3WorkflowFreeWindowStep;

export type RunCaseInputV3 = {
  schemaVersion: 3;
  setup?: CaseSetup;
  manifest: {
    id: string;
    kind: "method";
  };
  contract: V3ContractSpec;
  args: unknown;
  workflow: {
    steps: V3WorkflowStep[];
    cleanup?: V3WorkflowStep[];
  };
};

export type RunCaseInput = RunCaseInputLegacy | RunCaseInputV3;

// Backward-compatible aliases for still-renamed modules/tests; callers should migrate to V3 names.
export type V2ContractArgSpec = V3ContractArgSpec;
export type V2ContractResultProperty = V3ContractResultProperty;
export type V2ContractResultConstValue = V3ContractResultConstValue;
export type V2ContractResultConstSpec = V3ContractResultConstSpec;
export type V2ContractResultObjectSpec = V3ContractResultObjectSpec;
export type V2ContractResultSpec = V3ContractResultSpec;
export type V2ContractSpec = V3ContractSpec;
export type V2WorkflowAllocCellStep = V3WorkflowAllocCellStep;
export type V2WorkflowAllocWindowStep = V3WorkflowAllocWindowStep;
export type V2WorkflowSpiceCallName = V3WorkflowSpiceCallName;
export type V2WorkflowSpiceCallStep = V3WorkflowSpiceCallStep;
export type V2WorkflowMaterializeFixture = V3WorkflowMaterializeFixture;
export type V2WorkflowMaterializeStep = V3WorkflowMaterializeStep;
export type V2WorkflowDasOpenStep = V3WorkflowDasOpenStep;
export type V2WorkflowDlaBeginForwardSearchStep = V3WorkflowDlaBeginForwardSearchStep;
export type V2WorkflowDasCloseStep = V3WorkflowDasCloseStep;
export type V2WorkflowUnlinkStep = V3WorkflowUnlinkStep;
export type V2WorkflowInvokeLegacyCallStep = V3WorkflowCallContractStep;
export type V2WorkflowScriptStep = V3WorkflowScriptStep;
export type V2WorkflowAssertOperator = V3WorkflowAssertOperator;
export type V2WorkflowAssertTest = V3WorkflowAssertTest;
export type V2WorkflowAssertStep = V3WorkflowAssertStep;
export type V2WorkflowProjectResultStep = V3WorkflowProjectResultStep;
export type V2WorkflowProjectStep = V3WorkflowProjectStep;
export type V2WorkflowSwitchStep = V3WorkflowSwitchStep;
export type V2WorkflowFreeCellStep = V3WorkflowFreeCellStep;
export type V2WorkflowFreeWindowStep = V3WorkflowFreeWindowStep;
export type V2WorkflowStep = V3WorkflowStep;
export type RunCaseInputV2 = RunCaseInputV3;
export type RunCaseInputV1 = RunCaseInputLegacy;

export type SpiceErrorState = {
  failed: boolean;
  short?: string;
  long?: string;
  explain?: string;
  trace?: string;
};

export type RunnerErrorReport = {
  code?: string;
  name?: string;
  message: string;
  details?: {
    call?: string;
    [key: string]: unknown;
  };
  stack?: string;
  spice?: SpiceErrorState;
};

export type RunCaseResult =
  | { ok: true; result: unknown }
  | { ok: false; error: RunnerErrorReport };

/**
 * Minimal runner interface used by the backend verification DSL.
 */
export interface CaseRunner {
  readonly kind: string;
  /** Execute a single case (including any setup) and return its outcome. */
  runCase(input: RunCaseInput): Promise<RunCaseResult>;
  /** Optional cleanup hook for releasing any runner resources. */
  dispose?(): Promise<void> | void;
}
