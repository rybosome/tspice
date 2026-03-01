import type { AssertOperator } from "../assertOperators.js";

export type KernelEntry = string | { path: string; restrictToDir?: string };

export type CaseSetup = {
  kernels?: KernelEntry[];
};

export type RunCaseInputV1 = {
  schemaVersion?: 1;
  setup?: CaseSetup;
  call: string;
  args: unknown[];
};

export type V2ContractArgSpec = {
  name: string;
  type: "spiceInt";
  constraints?: {
    min?: number;
    max?: number;
  };
};

export type V2ContractResultProperty = {
  const?: string | number | boolean | null;
  type?: "spiceInt";
};

export type V2ContractResultConstValue =
  | string
  | number
  | boolean
  | null
  | V2ContractResultConstValue[]
  | { [key: string]: V2ContractResultConstValue };

export type V2ContractResultConstSpec = {
  const: V2ContractResultConstValue;
};

export type V2ContractResultObjectSpec = {
  type: "object";
  required?: string[];
  properties: Record<string, V2ContractResultProperty>;
};

export type V2ContractResultSpec = V2ContractResultObjectSpec | V2ContractResultConstSpec;

export type V2ContractSpec = {
  contractMethod: string;
  canonicalMethod: string;
  aliases?: string[];
  args?: V2ContractArgSpec[];
  result: V2ContractResultSpec;
  errors?: Array<{ code: string }>;
};

export type V2WorkflowAllocCellStep = {
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

export type V2WorkflowAllocWindowStep = {
  op: "allocWindow";
  as: string;
  params: {
    maxIntervals: unknown;
  };
};

export type V2WorkflowSpiceCallName =
  | "card_c"
  | "size_c"
  | "scard_c"
  | "ssize_c"
  | "valid_c"
  | "dskobj_c"
  | "dsksrf_c"
  | "dskgd_c"
  | "dskb02_c";

export type V2WorkflowSpiceCallStep = {
  op: "spiceCall";
  call: V2WorkflowSpiceCallName;
  in: unknown[];
  as?: string;
  out?: Record<string, string>;
};

export type V2WorkflowMaterializeFixture = "minimalDsk" | "virtualOutputSpk";

export type V2WorkflowMaterializeStep = {
  op: "materialize";
  fixture: V2WorkflowMaterializeFixture;
  as: string;
};

export type V2WorkflowDasOpenStep = {
  op: "dasOpen";
  path: unknown;
  as: string;
};

export type V2WorkflowDlaBeginForwardSearchStep = {
  op: "dlaBeginForwardSearch";
  handle: unknown;
  as: string;
};

export type V2WorkflowDasCloseStep = {
  op: "dasClose";
  target: unknown;
};

export type V2WorkflowUnlinkStep = {
  op: "unlink";
  target: unknown;
};

export type V2WorkflowInvokeLegacyCallStep = {
  op: "invokeLegacyCall";
  call?: string;
};

export type V2WorkflowAssertOperator = AssertOperator;

export type V2WorkflowAssertTest =
  | { eq: [unknown, unknown] }
  | { ne: [unknown, unknown] }
  | { gt: [unknown, unknown] }
  | { gte: [unknown, unknown] }
  | { lt: [unknown, unknown] }
  | { lte: [unknown, unknown] };

export type V2WorkflowAssertStep = {
  op: "assert";
  test: V2WorkflowAssertTest;
  error: {
    code: string;
    message: string;
  };
};

export type V2WorkflowProjectResultStep = {
  op: "projectResult";
  out: Record<string, unknown>;
};

export type V2WorkflowProjectStep = {
  op: "project";
  out: Record<string, unknown>;
};

export type V2WorkflowSwitchStep = {
  op: "switch";
  on: unknown;
  cases: Record<string, V2WorkflowStep[]>;
  default?: V2WorkflowStep[];
};

export type V2WorkflowFreeCellStep = {
  op: "freeCell";
  target: unknown;
};

export type V2WorkflowFreeWindowStep = {
  op: "freeWindow";
  target: unknown;
};

export type V2WorkflowStep =
  | V2WorkflowAllocCellStep
  | V2WorkflowAllocWindowStep
  | V2WorkflowMaterializeStep
  | V2WorkflowDasOpenStep
  | V2WorkflowDlaBeginForwardSearchStep
  | V2WorkflowDasCloseStep
  | V2WorkflowUnlinkStep
  | V2WorkflowSpiceCallStep
  | V2WorkflowInvokeLegacyCallStep
  | V2WorkflowAssertStep
  | V2WorkflowProjectStep
  | V2WorkflowSwitchStep
  | V2WorkflowProjectResultStep
  | V2WorkflowFreeCellStep
  | V2WorkflowFreeWindowStep;

export type RunCaseInputV2 = {
  schemaVersion: 2;
  setup?: CaseSetup;
  manifest: {
    id: string;
    kind: "method";
  };
  contract: V2ContractSpec;
  args: unknown;
  workflow: {
    steps: V2WorkflowStep[];
    cleanup?: V2WorkflowStep[];
  };
};

export type RunCaseInput = RunCaseInputV1 | RunCaseInputV2;

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
