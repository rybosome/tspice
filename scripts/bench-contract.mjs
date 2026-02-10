import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseYamlFile, validateBenchmarkSuiteV1 } from "@rybosome/tspice-bench-contract/v1";

const USAGE_TEXT = [
  "Usage:",
  "  pnpm bench:contract validate [--json] [--no-check-fixtures] <file>",
  "",
  "Examples:",
  "  pnpm bench:contract validate benchmarks/contracts/v1/example.yml",
  "  pnpm bench:contract validate --json benchmarks/contracts/v1/example.yml",
  "  pnpm bench:contract validate --no-check-fixtures benchmarks/contracts/v1/example.yml",
].join("\n");

function failUsage(message) {
  if (json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: false,
          errors: [{ path: "$", message }],
          usage: USAGE_TEXT,
        },
        null,
        2,
      ),
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(message);
    // eslint-disable-next-line no-console
    console.error(USAGE_TEXT);
  }

  process.exit(1);
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const command = args[0];

let checkFixtures = true;
let fileArg = null;

for (const arg of args.slice(1)) {
  if (arg === "--json") {
    continue;
  }

  if (arg === "--no-check-fixtures") {
    checkFixtures = false;
    continue;
  }

  if (arg.startsWith("-")) {
    failUsage(`Unknown argument: ${arg}`);
  }

  if (fileArg !== null) {
    failUsage("Expected a single <file> argument.");
  }

  fileArg = arg;
}

if (command !== "validate" || !fileArg) {
  failUsage(
    command !== "validate"
      ? `Unknown command: ${command ?? "<missing>"}`
      : "Missing required <file> argument.",
  );
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filePath = path.resolve(process.cwd(), fileArg);

const parsed = parseYamlFile(filePath);
if (!parsed.ok) {
  if (json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: false, errors: parsed.errors }, null, 2));
  } else {
    for (const err of parsed.errors) {
      // eslint-disable-next-line no-console
      console.error(`${err.path}: ${err.message}`);
    }
  }
  process.exit(1);
}

const validated = validateBenchmarkSuiteV1(parsed.value, {
  repoRoot,
  checkFixtureExistence: checkFixtures,
});

if (!validated.ok) {
  if (json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: false, errors: validated.errors }, null, 2));
  } else {
    for (const err of validated.errors) {
      // eslint-disable-next-line no-console
      console.error(`${err.path}: ${err.message}`);
    }
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(json ? JSON.stringify({ ok: true }, null, 2) : "OK");
