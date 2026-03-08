import { describe, expect, it } from "vitest";

import { METHOD_SURFACE_CALL_CONTRACT_CANONICAL } from "../../src/generated/methodSurfaceRegistry.js";
import { getCallContractDispatchRegistryCoverage } from "../../src/runners/tspiceRunner.js";

describe("tspice callContract dispatch registry coverage", () => {
  it("matches generated canonical method-surface keys exactly", () => {
    const coverage = getCallContractDispatchRegistryCoverage();
    const canonical = [...METHOD_SURFACE_CALL_CONTRACT_CANONICAL].sort();

    expect(coverage.missingCanonical).toEqual([]);
    expect(coverage.extraKeys).toEqual([]);
    expect(coverage.keys).toEqual(canonical);
  });
});
