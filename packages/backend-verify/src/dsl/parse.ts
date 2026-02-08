import * as path from "node:path";
import * as fs from "node:fs";

import type { ScenarioAst, ScenarioCaseAst, ScenarioSetupAst, ScenarioYamlFile } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  if (typeof value === "string") return value;
  throw new TypeError(`${label} must be a string (got ${JSON.stringify(value)})`);
}

function asStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of strings (got ${JSON.stringify(value)})`);
  }
  return value.map((v, i) => assertString(v, `${label}[${i}]`));
}

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findRepoRoot(startDir: string): string | undefined {
  let dir = path.resolve(startDir);

  while (true) {
    if (fileExists(path.join(dir, "pnpm-workspace.yaml")) || fileExists(path.join(dir, ".git"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function getFixturesRoot(sourceDir: string): string {
  const env = process.env.TSPICE_FIXTURES_DIR;
  if (env !== undefined && env.trim() !== "") {
    const raw = env.trim();
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }

  const repoRoot = findRepoRoot(sourceDir) ?? findRepoRoot(process.cwd());
  if (repoRoot === undefined) {
    throw new Error(
      "Unable to locate monorepo root (looked for pnpm-workspace.yaml or .git). " +
        "Set TSPICE_FIXTURES_DIR to an explicit fixtures directory.",
    );
  }

  return path.resolve(repoRoot, "packages/tspice/test/fixtures/kernels");
}

function resolvePackDirAlias(p: string): string {
  try {
    if (!fs.statSync(p).isDirectory()) return p;
  } catch {
    // Doesn't exist yet; defer errors until later.
    return p;
  }

  const metaKernel = path.join(p, `${path.basename(p)}.tm`);
  if (!fileExists(metaKernel)) {
    throw new Error(
      `Kernel pack directory alias '${p}' requires meta-kernel '${metaKernel}', but it does not exist`,
    );
  }
  return metaKernel;
}

function resolveKernelPath(p: string, sourceDir: string): string {
  // Absolute paths are passed through directly.
  if (path.isAbsolute(p)) return resolvePackDirAlias(p);

  // Expand `$FIXTURES/...` to the fixtures root.
  if (p === "$FIXTURES" || p.startsWith("$FIXTURES/") || p.startsWith("$FIXTURES\\")) {
    const suffix = p.slice("$FIXTURES".length).replace(/^[/\\]/, "");
    const fixturesRoot = getFixturesRoot(sourceDir);
    return resolvePackDirAlias(path.resolve(fixturesRoot, suffix));
  }

  // Otherwise resolve relative to the scenario file.
  return resolvePackDirAlias(path.resolve(sourceDir, p));
}

function parseSetup(raw: unknown, sourceDir: string): ScenarioSetupAst {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    throw new TypeError(`setup must be a mapping/object (got ${JSON.stringify(raw)})`);
  }

  const kernelsRaw = raw.kernels;
  const kernels = asStringArray(kernelsRaw, "setup.kernels").map((p) => resolveKernelPath(p, sourceDir));

  return kernels.length === 0 ? {} : { kernels };
}

function parseCase(raw: unknown, index: number, sourceDir: string): ScenarioCaseAst {
  if (!isRecord(raw)) {
    throw new TypeError(`cases[${index}] must be a mapping/object (got ${JSON.stringify(raw)})`);
  }

  if (raw.id === null) {
    // Treat `null` as explicit invalid input; only `undefined` counts as “missing”.
    throw new TypeError(`cases[${index}].id must be a string (got null)`);
  }

  const id = raw.id === undefined ? `case-${index}` : assertString(raw.id, `cases[${index}].id`);
  const call = assertString(raw.call, `cases[${index}].call`);
  const args = raw.args === undefined ? [] : raw.args;

  if (!Array.isArray(args)) {
    throw new TypeError(`cases[${index}].args must be an array (got ${JSON.stringify(args)})`);
  }

  return {
    id,
    call,
    args,
    setup: parseSetup(raw.setup, sourceDir),
    expect: raw.expect,
  };
}

export function parseScenario(file: ScenarioYamlFile): ScenarioAst {
  const { sourcePath, data } = file;
  const sourceDir = path.dirname(sourcePath);

  if (!isRecord(data)) {
    throw new TypeError(
      `Scenario YAML must be a mapping/object at the top level (got ${JSON.stringify(data)})`,
    );
  }

  const name = data.name === undefined ? undefined : assertString(data.name, "name");
  const setup = parseSetup(data.setup, sourceDir);

  if (!Array.isArray(data.cases)) {
    throw new TypeError(`cases must be an array (got ${JSON.stringify(data.cases)})`);
  }

  const cases = data.cases.map((c, i) => parseCase(c, i, sourceDir));
  if (cases.length === 0) {
    throw new TypeError("cases must contain at least one case");
  }

  const scenario: ScenarioAst = {
    cases,
    meta: { sourcePath },
  };

  if (name !== undefined) scenario.name = name;
  if (setup.kernels !== undefined) scenario.setup = setup;

  return scenario;
}
