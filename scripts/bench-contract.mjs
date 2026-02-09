import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseYamlFile, validateBenchmarkSuiteV1 } from "@rybosome/tspice-bench-contract/v1";

function usage() {
  // eslint-disable-next-line no-console
  console.error(
    [
      "Usage:",
      "  pnpm bench:contract validate [--json] <file>",
      "",
      "Examples:",
      "  pnpm bench:contract validate benchmarks/contracts/v1/example.yml",
      "  pnpm bench:contract validate --json benchmarks/contracts/v1/example.yml",
    ].join("\n"),
  );
}

const args = process.argv.slice(2);
const command = args[0];

let json = false;
let fileArg = null;

for (const arg of args.slice(1)) {
  if (arg === "--json") {
    json = true;
    continue;
  }

  if (arg.startsWith("-")) {
    usage();
    process.exit(1);
  }

  if (fileArg !== null) {
    usage();
    process.exit(1);
  }

  fileArg = arg;
}

if (command !== "validate" || !fileArg) {
  usage();
  process.exit(1);
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
  checkFixtureExistence: true,
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
