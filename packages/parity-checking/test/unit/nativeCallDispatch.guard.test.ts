import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { functionRegistry } from "../../src/generated/functionRegistry.js";
import { nativeCallDispatch } from "../../src/generated/nativeCallDispatch.js";

function toEnumSegment(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

function toIdentifierSegment(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (normalized.length === 0) {
    return "unknown";
  }

  return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
}

describe("native call dispatch codegen guard", () => {
  it("keeps native call dispatch entries aligned with spice invoke registry entries", () => {
    const expected = functionRegistry
      .filter((entry) => entry.impl.invoke === "spice")
      .map((entry) => ({
        id: entry.id,
        enumId: `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`,
        cSymbol: entry.impl.cSymbol,
        invoker: `v2_invoke_${toIdentifierSegment(entry.impl.cSymbol)}`,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const actual = [...nativeCallDispatch].sort((a, b) => a.id.localeCompare(b.id));

    expect(actual).toEqual(expected);
  });

  it("has a native invoker implementation for every generated dispatch row", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const packageRoot = path.resolve(testDir, "..", "..");
    const sourcePath = path.join(packageRoot, "native", "src", "cspice_runner_v2_call_invoke.c");

    const source = readFileSync(sourcePath, "utf8");
    const implementedInvokers = new Set(
      Array.from(source.matchAll(/static bool\s+(v2_invoke_[A-Za-z0-9_]+)\s*\(/g)).map((match) => match[1]),
    );

    for (const entry of nativeCallDispatch) {
      expect(implementedInvokers.has(entry.invoker)).toBe(true);
    }
  });
});
