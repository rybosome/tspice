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

    const dskmi2 = lookupGeneratedDispatchTableEntry("file-io.dskmi2");
    expect(dskmi2).not.toBeNull();
    expect(dskmi2?.behaviorClass).toBe("out-params-structured-payload");

    const ccifrm = lookupGeneratedDispatchTableEntry("frames.ccifrm");
    expect(ccifrm).not.toBeNull();
    expect(ccifrm?.behaviorClass).toBe("string-buffer-bounds");
  });

  it("provides lookup coverage for modeled vs unmodeled functions", () => {
    const modeled = lookupGeneratedDispatchTableEntry("coords-vectors.vdot");
    expect(modeled).not.toBeNull();
    expect(modeled?.implemented).toBe(true);
    expect(modeled?.executable).toEqual({
      ts: {
        method: "vdot",
      },
      native: {
        handler: "generated_dispatch_coords_vectors_vdot",
      },
    });

    const str2et = lookupGeneratedDispatchTableEntry("time.str2et");
    expect(str2et).not.toBeNull();
    expect(str2et?.implemented).toBe(true);
    expect(str2et?.executable).toEqual({
      ts: {
        method: "str2et",
      },
      native: {
        handler: "generated_dispatch_time_str2et",
      },
    });

    const unmodeled = lookupGeneratedDispatchTableEntry("time.__unmodeled__");
    expect(unmodeled).toBeNull();
  });
});
