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

const args = process.argv.slice(2);
const json = args.includes("--json");
const command = args[0];

function emitJson(obj) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj, null, 2));
}

function normalizeErrors(errors) {
  if (!Array.isArray(errors)) {
    if (errors == null) return [];
    return [{ path: "$", message: String(errors) }];
  }

  return errors.map((e) => ({
    path: typeof e?.path === "string" ? e.path : "$",
    message: typeof e?.message === "string" ? e.message : String(e?.message ?? e),
  }));
}

function emitJsonResult({ ok, kind, errors }) {
  emitJson({ ok: Boolean(ok), kind, errors: normalizeErrors(errors), usage: USAGE_TEXT });
}

function failUsage(message) {
  if (json) {
    emitJsonResult({
      ok: false,
      kind: "usage",
      errors: [{ path: "$", message }],
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(`$: ${message}`);
    // eslint-disable-next-line no-console
    console.error(USAGE_TEXT);
  }

  process.exit(1);
}

function failParse(errors) {
  if (json) {
    emitJsonResult({ ok: false, kind: "parse", errors });
  } else {
    for (const err of errors) {
      // eslint-disable-next-line no-console
      console.error(`${err.path}: ${err.message}`);
    }
  }
  process.exit(1);
}

function failValidate(errors) {
  if (json) {
    emitJsonResult({ ok: false, kind: "validate", errors });
  } else {
    for (const err of errors) {
      // eslint-disable-next-line no-console
      console.error(`${err.path}: ${err.message}`);
    }
  }
  process.exit(1);
}

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
  failParse(parsed.errors);
}

const validated = validateBenchmarkSuiteV1(parsed.value, {
  repoRoot,
  checkFixtureExistence: checkFixtures,
});

if (!validated.ok) {
  failValidate(validated.errors);
}

if (json) {
  emitJsonResult({ ok: true, kind: "success", errors: [] });
} else {
  // eslint-disable-next-line no-console
  console.log("OK");
}
