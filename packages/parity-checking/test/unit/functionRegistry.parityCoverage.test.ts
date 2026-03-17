import { describe, expect, it } from "vitest";

import { readContractCatalog } from "../../src/generated/readContractCatalog.js";
import { readFunctionRegistry } from "../../src/generated/readFunctionRegistry.js";

describe("function-registry contract coverage invariant", () => {
  it("exactly matches canonical backend contract methods (no missing, no extra)", () => {
    const contractMethods = readContractCatalog();
    const registry = readFunctionRegistry();

    const registryKeys = registry.functions.map((entry) => entry.key);

    expect(registryKeys).toEqual(contractMethods);
  });
});
