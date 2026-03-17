import { describe, expect, it } from "vitest";

import { methodCanonicalMethod } from "../../src/dsl/types.js";
import { loadParitySpecs } from "../../src/engine/loadParitySpecs.js";
import { readFunctionRegistry } from "../../src/generated/readFunctionRegistry.js";

function stableSort(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

describe("function-registry parity coverage invariant", () => {
  it("exactly matches the parity-tested method set (no missing, no extra)", async () => {
    const registry = readFunctionRegistry();
    const specs = await loadParitySpecs();

    const parityMethods = [...new Set(specs.methods.map((method) => methodCanonicalMethod(method)))].sort(
      (a, b) => stableSort(a, b),
    );

    const registryKeys = registry.functions.map((entry) => entry.key);

    expect(registryKeys).toEqual(parityMethods);
  });
});
