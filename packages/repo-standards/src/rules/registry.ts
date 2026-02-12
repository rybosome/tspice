export interface RuleDefinition {
  id: string;
  description: string;
}

export const ruleRegistry: RuleDefinition[] = [
  {
    id: "require-jsdoc-on-exported-callables",
    description: "Public exported callables must have JSDoc (not implemented yet)."
  },
  {
    id: "require-parity-scenario-for-backend-method",
    description: "Backend methods must have parity scenarios (not implemented yet)."
  },
  {
    id: "require-perf-benchmark-for-backend-method",
    description: "Backend methods must have perf benchmarks (not implemented yet)."
  }
];
