import { describe, expect, it } from "vitest";

import * as contract from "@rybosome/tspice-backend-contract";

describe("@rybosome/tspice-backend-contract", () => {
  it("can be imported (type-only surface)", () => {
    // This package is primarily TypeScript types; at runtime it should not
    // need to export any values.
    expect(Object.keys(contract)).toEqual([]);
  });
});
