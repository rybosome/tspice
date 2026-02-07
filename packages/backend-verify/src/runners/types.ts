export type CaseSetup = {
  kernels?: string[];
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
};

export type RunnerErrorReport = {
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
}
