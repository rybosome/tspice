export interface RuleConfig {
  packages: string[];
}

export interface RepoStandardsConfig {
  schemaVersion: number;
  rules: Record<string, RuleConfig>;
}

export const KNOWN_RULE_IDS = [
  "require-jsdoc-on-exported-callables",
  "require-parity-scenario-for-backend-method",
  "require-perf-benchmark-for-backend-method"
] as const;

export type KnownRuleId = (typeof KNOWN_RULE_IDS)[number];
