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
  compare?: ScenarioCompareAst;
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
