export type ScenarioSetupAst = {
  /** Kernel paths (resolved to absolute paths by the parser). */
  kernels?: string[];
};

export type ScenarioCaseAst = {
  id: string;
  setup?: ScenarioSetupAst;
  call: string;
  args?: unknown[];

  /**
   * Future-facing: expected value + comparison options.
   *
   * Phase A doesn't require wiring this up.
   */
  expect?: unknown;
};

export type ScenarioAst = {
  /** Human-readable name. */
  name?: string;

  setup?: ScenarioSetupAst;
  cases: ScenarioCaseAst[];

  meta: {
    sourcePath: string;
  };
};

export type ScenarioYamlFile = {
  sourcePath: string;
  text: string;
  data: unknown;
};
