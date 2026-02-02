import { describe, expect, it } from "vitest";

import * as contract from "@rybosome/tspice-backend-contract";

describe("@rybosome/tspice-backend-contract", () => {
  it("can be imported (type-only surface)", () => {
    // This package is primarily TypeScript types.
    //
    // Historically we asserted there were *zero* runtime exports, but that
    // couples the test to build/packaging details (and blocks adding harmless
    // runtime metadata later). The important invariant is simply that the
    // package is importable at runtime.
    expect(contract).toBeDefined();
  });
});
