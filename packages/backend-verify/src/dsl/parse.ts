import * as path from "node:path";

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

function parseSetup(raw: unknown, sourceDir: string): ScenarioSetupAst {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    throw new TypeError(`setup must be a mapping/object (got ${JSON.stringify(raw)})`);
  }

  const kernelsRaw = raw.kernels;
  const kernels = asStringArray(kernelsRaw, "setup.kernels").map((p) => {
    // Resolve relative paths against the scenario file.
    if (path.isAbsolute(p)) return p;
    return path.resolve(sourceDir, p);
  });

  return kernels.length === 0 ? {} : { kernels };
}

function parseCase(raw: unknown, index: number, sourceDir: string): ScenarioCaseAst {
  if (!isRecord(raw)) {
    throw new TypeError(`cases[${index}] must be a mapping/object (got ${JSON.stringify(raw)})`);
  }

  const id = assertString(raw.id ?? `case-${index}`, `cases[${index}].id`);
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
