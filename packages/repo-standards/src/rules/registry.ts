import { run as requireJsdocOnExportedCallables } from "./requireJsdocOnExportedCallables.js";
import { run as requireParityScenarioForBackendMethod } from "./requireParityScenarioForBackendMethod.js";
import { run as requirePerfBenchmarkForBackendMethod } from "./requirePerfBenchmarkForBackendMethod.js";
import type { RepoStandardsRule } from "./types.js";

// Rule IDs are the keys.
export const ruleRegistry = {
  "require-jsdoc-on-exported-callables": {
    description: "Public exported callables must have JSDoc.",
    run: requireJsdocOnExportedCallables
  },
  "require-parity-scenario-for-backend-method": {
    description: "Backend methods must have parity scenarios.",
    run: requireParityScenarioForBackendMethod
  },
  "require-perf-benchmark-for-backend-method": {
    description: "Backend methods must have perf benchmarks.",
    run: requirePerfBenchmarkForBackendMethod
  }
} as const satisfies Record<string, RepoStandardsRule>;

export type KnownRuleId = keyof typeof ruleRegistry;

export const knownRuleIds = Object.keys(ruleRegistry).sort() as KnownRuleId[];

export function isKnownRuleId(value: string): value is KnownRuleId {
  return Object.prototype.hasOwnProperty.call(ruleRegistry, value);
}
