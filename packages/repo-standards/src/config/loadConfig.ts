import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import YAML from "yaml";

import { isKnownRuleId, knownRuleIds } from "../rules/registry.js";
import { ConfigError } from "../util/errors.js";
import { normalizeRepoRelativePath } from "../util/paths.js";
import type { RepoStandardsConfig, RuleConfig } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRuleConfig(ruleId: string, value: unknown): RuleConfig {
  if (!isRecord(value)) {
    throw new ConfigError(`rules.${ruleId} must be an object`);
  }

  const pkgs = value.packages;
  if (!Array.isArray(pkgs) || !pkgs.every((p) => typeof p === "string")) {
    throw new ConfigError(`rules.${ruleId}.packages must be a string[]`);
  }

  const packages = pkgs.map((p) => {
    try {
      return normalizeRepoRelativePath(p);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigError(`rules.${ruleId}.packages contains invalid path: ${message}`);
    }
  });

  return { packages };
}

export interface LoadConfigOptions {
  repoRoot: string;
  configPath: string;
  stderr?: NodeJS.WritableStream;
}

export async function loadConfig(
  opts: LoadConfigOptions
): Promise<{ configPath: string; config: RepoStandardsConfig }> {
  const absPath = path.resolve(opts.repoRoot, opts.configPath);
  const stderr = opts.stderr ?? process.stderr;

  let raw: string;
  try {
    raw = await fs.readFile(absPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      throw new ConfigError(`config not found: ${opts.configPath}`);
    }

    if (code === "EACCES" || code === "EPERM") {
      throw new ConfigError(`cannot read config (permission denied): ${opts.configPath}`);
    }

    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`failed to read config ${opts.configPath}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`invalid YAML in ${opts.configPath}: ${msg}`);
  }

  if (!isRecord(parsed)) {
    throw new ConfigError("config root must be an object");
  }

  const schemaVersion = parsed.schemaVersion;
  if (schemaVersion !== 1) {
    throw new ConfigError(`schemaVersion must be 1 (got ${String(schemaVersion)})`);
  }

  const rulesRaw = parsed.rules;
  if (!isRecord(rulesRaw)) {
    throw new ConfigError("rules must be an object");
  }

  // Accept unknown rules for forward-compat, but validate known ones if present.
  const rules: Record<string, RuleConfig> = {};
  const unknownRuleIds: string[] = [];

  for (const [ruleId, ruleCfg] of Object.entries(rulesRaw)) {
    if (!isKnownRuleId(ruleId)) {
      unknownRuleIds.push(ruleId);
      continue;
    }

    rules[ruleId] = assertRuleConfig(ruleId, ruleCfg);
  }

  if (unknownRuleIds.length > 0) {
    stderr.write(
      `warning: unknown rule ID(s) in ${opts.configPath}: ${unknownRuleIds.sort().join(", ")} (ignoring)\n`
    );
  }

  // Ensure known rules exist, even if empty, so reporting is stable.
  for (const id of knownRuleIds) {
    if (!rules[id]) {
      rules[id] = { packages: [] };
    }
  }

  return {
    configPath: opts.configPath,
    config: {
      schemaVersion: 1,
      rules
    }
  };
}
