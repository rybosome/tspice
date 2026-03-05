import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { functionRegistry, lookupFunctionRegistryEntry } from "../../src/generated/functionRegistry.js";
import { nativeCallDispatch } from "../../src/generated/nativeCallDispatch.js";
import { nativeReturnBindings } from "../../src/generated/nativeReturnBindings.js";

const SHARED_RETURN_NATIVE_INVOKER = "v2_invoke_contract_return";

function toEnumSegment(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

function discoverYamlFiles(rootDir: string): string[] {
  const out: string[] = [];

  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
      } else if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
        out.push(abs);
      }
    }
  };

  visit(rootDir);
  return out;
}

function collectCallFns(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectCallFns(item, out);
    }
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  if (record.op === "call" && typeof record.fn === "string") {
    out.add(record.fn);
  }

  for (const nested of Object.values(record)) {
    collectCallFns(nested, out);
  }
}

describe("native call dispatch codegen guard", () => {
  it("keeps native call dispatch entries aligned with callable function registry entries", () => {
    const expected = functionRegistry
      .map((entry) => ({
        id: entry.id,
        enumId: `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`,
        cSymbol: entry.impl.cSymbol,
        invoker: entry.impl.nativeInvoker,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const actual = [...nativeCallDispatch].sort((a, b) => a.id.localeCompare(b.id));

    expect(actual).toEqual(expected);
  });

  it("keeps generated native return bindings aligned with shared return dispatch entries", () => {
    const expected = functionRegistry
      .filter(
        (entry) =>
          entry.result.mode === "return" &&
          entry.impl.nativeInvoker === SHARED_RETURN_NATIVE_INVOKER,
      )
      .map((entry) => ({
        id: entry.id,
        enumId: `V2_FUNCTION_ID_${toEnumSegment(entry.id)}`,
        cSymbol: entry.impl.cSymbol,
        kind: entry.impl.returnBinding?.kind ?? "none",
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const actual = [...nativeReturnBindings].sort((a, b) => a.id.localeCompare(b.id));

    expect(actual).toEqual(expected);
  });

  it("covers every shared return dispatch row with generated return binding metadata", () => {
    const bindingById = new Map(nativeReturnBindings.map((entry) => [entry.id, entry]));

    const sharedReturnDispatchRows = nativeCallDispatch.filter(
      (entry) => entry.invoker === SHARED_RETURN_NATIVE_INVOKER,
    );

    for (const entry of sharedReturnDispatchRows) {
      const binding = bindingById.get(entry.id);
      expect(binding, `Missing generated native return binding for fn id: ${entry.id}`).toBeDefined();
      expect(binding?.cSymbol).toBe(entry.cSymbol);
    }
  });

  it("ensures every call fn referenced by parity method workflows resolves to a native dispatch target", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const packageRoot = path.resolve(testDir, "..", "..");
    const methodsDir = path.join(packageRoot, "specs", "methods");

    const callFns = new Set<string>();
    for (const filePath of discoverYamlFiles(methodsDir)) {
      const parsed = parseYaml(readFileSync(filePath, "utf8"));
      collectCallFns(parsed, callFns);
    }

    const dispatchById = new Map(nativeCallDispatch.map((entry) => [entry.id, entry]));

    for (const fn of [...callFns].sort((a, b) => a.localeCompare(b))) {
      const registryEntry = lookupFunctionRegistryEntry(fn);
      expect(registryEntry, `Missing function registry entry for call fn: ${fn}`).toBeDefined();

      const dispatchEntry = dispatchById.get(registryEntry!.id);
      expect(dispatchEntry, `Missing native dispatch target for call fn: ${fn} (id=${registryEntry!.id})`).toBeDefined();
    }
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
