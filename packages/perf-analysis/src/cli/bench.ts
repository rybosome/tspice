import * as fs from "node:fs";
import * as path from "node:path";

import { runNodeNativeBench } from "../runners/node-native/index.js";

function usage(): string {
  return [
    "Usage:",
    "  pnpm bench --backend node-native --suite micro [--outDir <dir>]",
    "",
    "Options:",
    "  --backend   Currently only supports: node-native",
    "  --suite     Built-in suite id (e.g. micro) or a path to a .yml/.yaml file",
    "  --outDir    Output directory (default: ./artifacts/bench/<backend>/<suite>/)",
    "",
    "Outputs:",
    "  raw.json  - full samples + metadata for debugging",
    "  bmf.json  - Bencher Metric Format (BMF)",
  ].join("\n");
}

type Args = {
  backend?: string;
  suite?: string;
  outDir?: string;
  help?: boolean;
};

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }

    const take = (): string => {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`Missing value for ${a}`);
      }
      i++;
      return next;
    };

    if (a === "--backend") {
      args.backend = take();
      continue;
    }

    if (a === "--suite") {
      args.suite = take();
      continue;
    }

    if (a === "--outDir") {
      args.outDir = take();
      continue;
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }

    throw new Error(`Unexpected positional argument: ${a}`);
  }

  return args;
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.endsWith(".yml") || value.endsWith(".yaml");
}

function resolveSuitePath(suiteArg: string): { suiteId: string; suitePath: string } {
  if (looksLikePath(suiteArg)) {
    const suitePath = path.resolve(process.cwd(), suiteArg);
    const base = path.basename(suitePath);
    const suiteId = base.replace(/\.(ya?ml)$/i, "");
    return { suiteId, suitePath };
  }

  const suitesDir = path.resolve(
    process.cwd(),
    "packages",
    "perf-analysis",
    "src",
    "suites",
    "yaml",
    "v1",
  );

  const yml = path.join(suitesDir, `${suiteArg}.yml`);
  const yaml = path.join(suitesDir, `${suiteArg}.yaml`);

  if (fs.existsSync(yml)) return { suiteId: suiteArg, suitePath: yml };
  if (fs.existsSync(yaml)) return { suiteId: suiteArg, suitePath: yaml };

  throw new Error(
    `Unknown suite ${JSON.stringify(suiteArg)}. Expected one of:\n` +
      `- ${yml}\n` +
      `- ${yaml}\n` +
      `Tip: pass --suite <path/to/file.yml> to run a custom suite file.`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(usage() + "\n");
    return;
  }

  const backend = args.backend;
  const suite = args.suite;
  if (!backend || !suite) {
    throw new Error(["Missing required args.", "", usage()].join("\n"));
  }

  if (backend !== "node-native") {
    throw new Error(`Unsupported --backend ${JSON.stringify(backend)} (expected "node-native")`);
  }

  const { suiteId, suitePath } = resolveSuitePath(suite);
  const outDir = path.resolve(
    args.outDir ?? path.join("artifacts", "bench", backend, suiteId),
  );

  const result = await runNodeNativeBench({
    suiteId,
    suitePath,
    outDir,
  });

  process.stdout.write(`Wrote benchmark artifacts:\n- ${result.rawPath}\n- ${result.bmfPath}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
