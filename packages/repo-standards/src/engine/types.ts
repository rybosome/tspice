export interface ViolationLocation {
  filePath?: string;
  line?: number;
  col?: number;
  callId?: string;
}

export interface Violation {
  ruleId: string;
  packageRoot: string;
  message: string;
  location?: ViolationLocation;
}

export interface RepoStandardsReport {
  repoRoot: string;
  violations: Violation[];
}

export interface RunStandardsOptions {
  repoRoot: string;
  config: {
    schemaVersion: number;
    rules: Record<string, { packages: string[] }>;
  };
  onlyRuleId?: string;
  onlyPackageRoot?: string;
}
