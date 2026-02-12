export interface RuleConfig {
  packages: string[];
}

export interface RepoStandardsConfig {
  schemaVersion: number;
  rules: Record<string, RuleConfig>;
}
