export type KernelEntry = string | { path: string; restrictToDir?: string };

export type CaseSetup = {
  kernels?: KernelEntry[];
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
  args?: V3ContractArgSpec[];
  result?: V3ContractResultSpec;
  errors?: Array<{ code: string }>;
};

export type V3WorkflowCallStep = {
  op: "call";
  fn: string;
  in: unknown;
};

export type V3WorkflowStep = V3WorkflowCallStep;

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
  };
};

export type RunCaseInput = RunCaseInputV3;

export type SpiceErrorState = {
  failed: boolean;
  short?: string;
  long?: string;
  explain?: string;
  trace?: string;
};

export type RunnerErrorReport = {
  code?: string;
  lane?: string;
  callId?: string;
  reason?: string;
  name?: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  spice?: SpiceErrorState;
};

export type RunCaseResult =
  | { ok: true; result: unknown }
  | { ok: false; error: RunnerErrorReport };

export type CaseRunnerBackendMetadata = {
  requestedBackend: "auto" | "node" | "wasm";
  actualBackend: "node" | "wasm";
  fallbackDetected: boolean;
};

/**
 * Minimal runner interface used by the backend verification DSL.
 */
export interface CaseRunner {
  readonly kind: string;
  readonly backendMetadata?: CaseRunnerBackendMetadata;
  /** Execute a single case (including any setup) and return its outcome. */
  runCase(input: RunCaseInput): Promise<RunCaseResult>;
  /** Optional cleanup hook for releasing any runner resources. */
  dispose?(): Promise<void> | void;
}
