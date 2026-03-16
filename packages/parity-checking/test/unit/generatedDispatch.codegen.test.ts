import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readFunctionRegistry } from "../../src/generated/readFunctionRegistry.js";
import {
  GENERATED_DISPATCH_TABLE,
  lookupGeneratedDispatchTableEntry,
} from "../../src/runners/generatedDispatchTable.generated.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function generatedArtifactPaths(): string[] {
  const root = packageRoot();
  return [
    path.join(root, "src", "runners", "generatedDispatchTable.generated.ts"),
    path.join(root, "native", "src", "cspice_runner_generated_dispatch_table.h"),
    path.join(root, "native", "src", "cspice_runner_generated_dispatch_table.c"),
  ];
}

describe("generated dispatch codegen", () => {
  it("regenerates dispatch artifacts deterministically", () => {
    const before = new Map<string, string>();
    for (const artifactPath of generatedArtifactPaths()) {
      before.set(artifactPath, fs.readFileSync(artifactPath, "utf8"));
    }

    const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const run = spawnSync(pnpmCmd, ["run", "generate:dispatch-artifacts"], {
      cwd: packageRoot(),
      encoding: "utf8",
    });

    expect(run.status).toBe(0);

    for (const artifactPath of generatedArtifactPaths()) {
      const after = fs.readFileSync(artifactPath, "utf8");
      expect(after).toBe(before.get(artifactPath));
    }
  });

  it("mirrors function-registry keys and behavior classes", () => {
    const registry = readFunctionRegistry();
    const registryKeys = registry.functions.map((entry) => entry.key);
    const tableKeys = GENERATED_DISPATCH_TABLE.map((entry) => entry.key);

    expect(tableKeys).toEqual(registryKeys);

    const classes = new Set(GENERATED_DISPATCH_TABLE.map((entry) => entry.behaviorClass));
    expect(classes.has("input-mapping-scalar-output")).toBe(true);
    expect(classes.has("out-params-structured-payload")).toBe(true);
    expect(classes.has("integer-return-split")).toBe(true);
    expect(classes.has("complex-return-form")).toBe(true);
    expect(classes.has("string-buffer-bounds")).toBe(true);
  });

  it("provides lookup coverage for modeled vs unmodeled functions", () => {
    const modeled = lookupGeneratedDispatchTableEntry("time.str2et");
    expect(modeled).not.toBeNull();
    expect(modeled?.implemented).toBe(false);

    const unmodeled = lookupGeneratedDispatchTableEntry("time.__unmodeled__");
    expect(unmodeled).toBeNull();
  });
});
