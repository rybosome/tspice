export type KernelEntry = string | { path: string; restrictToDir?: string };

export type CaseSetup = {
  kernels?: KernelEntry[];
};

export type RunCaseInput = {
  setup?: CaseSetup;
  call: string;
  args: unknown[];
};

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
  stack?: string;
  spice?: SpiceErrorState;
};

export type RunCaseResult =
  | { ok: true; result: unknown }
  | { ok: false; error: RunnerErrorReport };

export interface CaseRunner {
  readonly kind: string;
  runCase(input: RunCaseInput): Promise<RunCaseResult>;
  dispose?(): Promise<void> | void;
}
