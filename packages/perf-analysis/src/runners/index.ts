export type { RunSuiteOptions, Runner, RunnerResult } from "./types.js";

export type { CreateTspiceRunnerOptions } from "./tspice/index.js";
export { createTspiceRunner } from "./tspice/index.js";

export type {
  BencherMetricFormat,
  NodeNativeBenchBackend,
  NodeNativeBenchRawOutput,
  NodeNativeBenchResult,
  RunNodeNativeBenchOptions,
} from "./node-native/index.js";

export { runNodeNativeBench } from "./node-native/index.js";
