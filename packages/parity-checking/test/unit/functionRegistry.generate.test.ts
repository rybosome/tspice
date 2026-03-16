import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readFunctionRegistry } from "../../src/generated/readFunctionRegistry.js";

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function registryPath(): string {
  return path.join(packageRoot(), "catalogs", "function-registry.json");
}

describe("function-registry generation", () => {
  it("regenerates deterministically", () => {
    const before = fs.readFileSync(registryPath(), "utf8");

    const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const run = spawnSync(pnpmCmd, ["run", "generate:function-registry"], {
      cwd: packageRoot(),
      encoding: "utf8",
    });

    expect(run.status).toBe(0);

    const after = fs.readFileSync(registryPath(), "utf8");
    expect(after).toBe(before);
  });

  it("loads as sorted, validated catalog with canonical field order", () => {
    const catalog = readFunctionRegistry();
    const keys = catalog.functions.map((entry) => entry.key);
    const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(keys).toEqual(sorted);

    const raw = JSON.parse(fs.readFileSync(registryPath(), "utf8")) as {
      functions: Array<Record<string, unknown>>;
    };

    for (const fn of raw.functions) {
      const fields = Object.keys(fn);
      const inputIndex = fields.indexOf("input");
      const outputIndex = fields.indexOf("output");
      const buffersIndex = fields.indexOf("buffers");

      expect(inputIndex).toBeGreaterThan(-1);

      if (outputIndex !== -1) {
        expect(outputIndex).toBeGreaterThan(inputIndex);
      }

      if (buffersIndex !== -1) {
        const baseline = outputIndex === -1 ? inputIndex : outputIndex;
        expect(buffersIndex).toBeGreaterThan(baseline);
      }
    }
  });
});
