/** Per-rule configuration (currently: packages the rule applies to). */
export interface RuleConfig {
  packages: string[];
}

/** Root repo-standards configuration file schema. */
export interface RepoStandardsConfig {
  schemaVersion: number;
  rules: Record<string, RuleConfig>;
}
