import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config/loadConfig.js";
import { runStandards } from "./engine/run.js";
import { formatJsonReport } from "./reporting/formatJson.js";
import { formatPrettyReport } from "./reporting/formatPretty.js";
import { isKnownRuleId, knownRuleIds } from "./rules/registry.js";
import { ConfigError, UsageError } from "./util/errors.js";
import { normalizeRepoRelativePath } from "./util/paths.js";

type OutputFormat = "pretty" | "json";

/** Options parsed from CLI flags (after validation). */
export interface CliOptions {
  configPath: string;
  format: OutputFormat;
  ruleId?: string;
  packageRoot?: string;
}

export type ParseResult =
  | {
      kind: "help";
    }
  | {
      kind: "run";
      options: CliOptions;
    };

/**
 * Returns a help/usage string for the `tspice-repo-standards` CLI.
 */
export function usage(): string {
  return [
    "Repo Standards Engine (skeleton)",
    "",
    "Usage:",
    "  tspice-repo-standards [--config <path>] [--format pretty|json] [--rule <ruleId>] [--package <dir>]",
    "",
    "Flags:",
    "  --config <path>        Path to repo standards config (default: repo-standards.yml)",
    "  --format pretty|json   Output format (default: pretty)",
    "  --rule <ruleId>        Run only a single rule (debugging)",
    "  --package <dir>        Run only a single package root (debugging)",
    "",
    "Exit codes:",
    "  0 = no violations",
    "  1 = violations found",
    "  2 = config/usage error"
  ].join("\n");
}

/**
 * Parses raw CLI argv into a strongly-typed run or help request.
 */
export function parseCliArgs(rawArgv: string[]): ParseResult {
  const argv: string[] = [];
  const positionals: string[] = [];
  let parsingFlags = true;

  for (const arg of rawArgv) {
    if (parsingFlags && arg === "--") {
      parsingFlags = false;
      continue;
    }

    if (parsingFlags) {
      argv.push(arg);
    } else {
      positionals.push(arg);
    }
  }

  let configPath = "repo-standards.yml";
  let format: OutputFormat = "pretty";
  let ruleId: string | undefined;
  let packageRoot: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }

    if (arg === "--config") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new UsageError("--config requires a <path>");
      }
      configPath = next;
      i++;
      continue;
    }

    if (arg === "--format") {
      const next = argv[i + 1];
      if (next !== "pretty" && next !== "json") {
        throw new UsageError("--format must be one of: pretty, json");
      }
      format = next;
      i++;
      continue;
    }

    if (arg === "--rule") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new UsageError("--rule requires a <ruleId>");
      }

      if (!isKnownRuleId(next)) {
        throw new UsageError(`unknown ruleId: ${next} (known: ${knownRuleIds.join(", ")})`);
      }

      ruleId = next;
      i++;
      continue;
    }

    if (arg === "--package") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new UsageError("--package requires a <dir>");
      }
      try {
        packageRoot = normalizeRepoRelativePath(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new UsageError(`--package contains invalid path: ${message}`);
      }
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new UsageError(`unknown flag: ${arg}`);
    }

    throw new UsageError(`unexpected positional argument: ${arg}`);
  }

  if (positionals.length > 0) {
    throw new UsageError(`unexpected positional arguments: ${positionals.join(" ")}`);
  }

  return {
    kind: "run",
    options: {
      configPath,
      format,
      ...(ruleId ? { ruleId } : {}),
      ...(packageRoot ? { packageRoot } : {})
    }
  };
}

/** IO dependencies for {@link main} (abstracted for testing). */
export interface MainIo {
  cwd: string;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

/**
 * CLI entrypoint: loads config, executes standards, and writes a formatted report.
 */
export async function main(rawArgv: string[], io: MainIo): Promise<number> {
  try {
    const parsed = parseCliArgs(rawArgv);

    if (parsed.kind === "help") {
      io.stdout.write(`${usage()}\n`);
      return 0;
    }

    const repoRoot = io.cwd;

    const loaded = await loadConfig({
      repoRoot,
      configPath: parsed.options.configPath,
      stderr: io.stderr
    });

    const runOptions = {
      repoRoot,
      configPath: loaded.configPath,
      config: loaded.config,
      ...(parsed.options.ruleId ? { onlyRuleId: parsed.options.ruleId } : {}),
      ...(parsed.options.packageRoot ? { onlyPackageRoot: parsed.options.packageRoot } : {})
    };

    const report = await runStandards(runOptions);

    const out = parsed.options.format === "json" ? formatJsonReport(report) : formatPrettyReport(report);

    io.stdout.write(`${out}\n`);

    return report.violations.length > 0 ? 1 : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (err instanceof UsageError) {
      io.stderr.write(`error: ${message}\n\n${usage()}\n`);
      return 2;
    }

    if (err instanceof ConfigError) {
      io.stderr.write(`error: ${message}\n`);
      return 2;
    }

    io.stderr.write(`error: ${message}\n`);
    return 2;
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  void main(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr
  }).then((code) => {
    process.exitCode = code;
  });
}
