export interface RuleDefinition {
  description: string;
}

// Rule IDs are the keys.
export const ruleRegistry = {
  "require-jsdoc-on-exported-callables": {
    description: "Public exported callables must have JSDoc (not implemented yet)."
  },
  "require-parity-scenario-for-backend-method": {
    description: "Backend methods must have parity scenarios (not implemented yet)."
  },
  "require-perf-benchmark-for-backend-method": {
    description: "Backend methods must have perf benchmarks (not implemented yet)."
  }
} as const satisfies Record<string, RuleDefinition>;

export type KnownRuleId = keyof typeof ruleRegistry;

export const knownRuleIds = Object.keys(ruleRegistry).sort() as KnownRuleId[];

export function isKnownRuleId(value: string): value is KnownRuleId {
  return Object.prototype.hasOwnProperty.call(ruleRegistry, value);
}
