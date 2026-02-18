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

export type LoadedParitySpecs = {
  workflows: WorkflowSpec[];
  methods: MethodSpec[];
  crossCutting: CrossCuttingSpec[];
};

export type ResolvedMethodSpec = {
  method: MethodSpec;
  includeOrder: WorkflowSpec[];
  mergedSetup?: ScenarioSetupAst;
  mergedCompareDefaults?: ScenarioCompareAst;
};
