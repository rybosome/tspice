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

export type V2WorkflowSpiceCallWithOutputStep = {
  op: "spiceCall";
  call: "card_c" | "size_c" | "dskgd_c" | "dskb02_c";
  in: unknown[];
  as: string;
};

export type V2WorkflowSpiceCallWithoutOutputStep = {
  op: "spiceCall";
  call:
    | "scard_c"
    | "ssize_c"
    | "valid_c"
    | "ekifld_c"
    | "ekacli_c"
    | "ekacld_c"
    | "ekaclc_c"
    | "ekffld_c"
    | "ekfind_c"
    | "ekgi_c"
    | "ekgd_c"
    | "ekgc_c"
    | "dskobj_c"
    | "dsksrf_c"
    | "dskmi2_c"
    | "dskopn_c"
    | "dskw02_c"
    | "readVirtualOutput";
  in: unknown[];
  as?: never;
};

export type V2WorkflowSpiceCallStep =
  | V2WorkflowSpiceCallWithOutputStep
  | V2WorkflowSpiceCallWithoutOutputStep;

export type V2WorkflowInvokeLegacyCallStep = {
  op: "invokeLegacyCall";
  call?: string;
};
export type V2WorkflowProjectResultStep = {
  op: "projectResult";
  out: Record<string, unknown>;
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
  | V2WorkflowSpiceCallStep
  | V2WorkflowInvokeLegacyCallStep
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
