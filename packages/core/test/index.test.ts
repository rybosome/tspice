import { describe, expect, it } from "vitest";

import { invariant } from "@rybosome/tspice-core";

describe("@rybosome/tspice-core", () => {
  it("throws when condition is false", () => {
    expect(() => invariant(false)).toThrow("Invariant violation");
  });
});
