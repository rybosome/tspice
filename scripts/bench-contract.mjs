import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseYamlFile, validateBenchmarkSuiteV1 } from "@rybosome/tspice-bench-contract/v1";

function usage() {
  // eslint-disable-next-line no-console
  console.error(
    [
      "Usage:",
      "  pnpm bench:contract validate <file>",
      "",
      "Examples:",
      "  pnpm bench:contract validate benchmarks/contracts/v1/example.yml",
    ].join("\n"),
  );
}

const [command, fileArg] = process.argv.slice(2);

if (command !== "validate" || !fileArg) {
  usage();
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filePath = path.resolve(process.cwd(), fileArg);

const parsed = parseYamlFile(filePath);
if (!parsed.ok) {
  for (const err of parsed.errors) {
    // eslint-disable-next-line no-console
    console.error(`${err.path}: ${err.message}`);
  }
  process.exit(1);
}

const validated = validateBenchmarkSuiteV1(parsed.value, {
  repoRoot,
  checkFixtureExistence: true,
});

if (!validated.ok) {
  for (const err of validated.errors) {
    // eslint-disable-next-line no-console
    console.error(`${err.path}: ${err.message}`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("OK");
