import { describe, expect, it } from "vitest";

import * as contract from "@rybosome/tspice-backend-contract";

describe("@rybosome/tspice-backend-contract", () => {
  it("has zero runtime exports (types-only package)", () => {
    // This package is intentionally *types only*.
    // If we ever add runtime exports here, we should treat that as a breaking
    // contract change and update the docs/tests accordingly.
    expect(Object.keys(contract)).toEqual([]);
  });
});
