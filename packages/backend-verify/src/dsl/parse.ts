import * as path from "node:path";
import * as fs from "node:fs";

import type { ScenarioAst, ScenarioCaseAst, ScenarioSetupAst, ScenarioYamlFile } from "./types.js";
import { resolveMetaKernelKernelsToLoad } from "../kernels/metaKernel.js";

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
  return fs.existsSync(p);
}

function isExistingDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findRepoRootByMarker(startDir: string, marker: string): string | undefined {
  let dir = path.resolve(startDir);

  while (true) {
    if (fileExists(path.join(dir, marker))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function findRepoRootByWorkspace(startDir: string): string | undefined {
  return findRepoRootByMarker(startDir, "pnpm-workspace.yaml");
}

function findRepoRootByGit(startDir: string): string | undefined {
  return findRepoRootByMarker(startDir, ".git");
}

function getFixturesRoot(sourceDir: string): string {
  const env = process.env.TSPICE_FIXTURES_DIR;
  if (env !== undefined && env.trim() !== "") {
    const raw = env.trim();
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);

    if (!isExistingDir(resolved)) {
      throw new Error(
        `TSPICE_FIXTURES_DIR must point to an existing directory (got ${JSON.stringify(resolved)})`,
      );
    }

    return resolved;
  }

  // Prefer the pnpm-workspace marker first; only fall back to `.git` when the
  // workspace marker is absent. This avoids accidentally treating nested git
  // repos as the monorepo root.
  const repoRoot =
    findRepoRootByWorkspace(sourceDir) ??
    findRepoRootByWorkspace(process.cwd()) ??
    findRepoRootByGit(sourceDir) ??
    findRepoRootByGit(process.cwd());

  if (repoRoot === undefined) {
    throw new Error(
      "Unable to locate monorepo root (looked for pnpm-workspace.yaml, then .git). " +
        "Set TSPICE_FIXTURES_DIR to an explicit fixtures directory.",
    );
  }

  const fixturesRoot = path.resolve(repoRoot, "packages/tspice/test/fixtures/kernels");
  if (!isExistingDir(fixturesRoot)) {
    throw new Error(
      `Unable to locate fixtures directory at ${JSON.stringify(fixturesRoot)}. ` +
        `Set TSPICE_FIXTURES_DIR to an explicit fixtures directory.`,
    );
  }

  return fixturesRoot;
}

function expandFixturePackDir(dirPath: string, originalEntry: string): string[] {
  const metaKernel = path.join(dirPath, `${path.basename(dirPath)}.tm`);
  if (!fileExists(metaKernel)) {
    throw new Error(
      `Kernel directory ${JSON.stringify(dirPath)} was treated as a fixture pack alias but is missing meta-kernel ${JSON.stringify(metaKernel)}.` +
        ` (from entry ${JSON.stringify(originalEntry)}) ` +
        `If you meant to load a specific kernel file, point to the file directly (e.g. ${JSON.stringify(metaKernel)}).`,
    );
  }

  const metaKernelText = fs.readFileSync(metaKernel, "utf8");
  const kernels = resolveMetaKernelKernelsToLoad(metaKernelText, metaKernel, { restrictToDir: dirPath });

  if (kernels.length === 0) {
    throw new Error(
      `Fixture pack meta-kernel did not specify any KERNELS_TO_LOAD entries: ${JSON.stringify(metaKernel)} ` +
        `(from entry ${JSON.stringify(originalEntry)})`,
    );
  }

  return kernels;
}

function resolveKernelPaths(p: string, sourceDir: string): string[] {
  const resolveMaybePack = (resolved: string): string[] => {
    // If it exists and is a directory, treat it as a fixture-pack alias.
    if (isExistingDir(resolved)) {
      return expandFixturePackDir(resolved, p);
    }

    // Otherwise it should be a kernel file path (it may or may not exist yet).
    return [resolved];
  };

  // Absolute paths are passed through directly.
  if (path.isAbsolute(p)) return resolveMaybePack(p);

  // Expand `$FIXTURES/...` to the fixtures root.
  if (p === "$FIXTURES" || p.startsWith("$FIXTURES/") || p.startsWith("$FIXTURES\\")) {
    const suffix = p.slice("$FIXTURES".length).replace(/^[/\\]/, "");
    const fixturesRoot = getFixturesRoot(sourceDir);

    const resolved = path.resolve(fixturesRoot, suffix);
    const rel = path.relative(fixturesRoot, resolved);
    if (rel === ".." || rel.startsWith(`..${path.sep}`)) {
      throw new Error(`$FIXTURES path must not escape fixtures root: ${JSON.stringify(p)}`);
    }

    return resolveMaybePack(resolved);
  }

  if (p.startsWith("$FIXTURES")) {
    throw new Error(`Invalid $FIXTURES usage: ${JSON.stringify(p)} (expected $FIXTURES/<path>)`);
  }

  // Otherwise resolve relative to the scenario file.
  return resolveMaybePack(path.resolve(sourceDir, p));
}

function parseSetup(raw: unknown, sourceDir: string): ScenarioSetupAst {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    throw new TypeError(`setup must be a mapping/object (got ${JSON.stringify(raw)})`);
  }

  const kernelsRaw = raw.kernels;
  const kernels = asStringArray(kernelsRaw, "setup.kernels").flatMap((p) => resolveKernelPaths(p, sourceDir));

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
