import { describe, expect, it } from "vitest";

import { assertNever, invariant } from "@rybosome/tspice-core";

describe("@rybosome/tspice-core", () => {
  it("throws when condition is false", () => {
    expect(() => invariant(false)).toThrow("Invariant violation");
  });

  it("throws for assertNever", () => {
    expect(() => assertNever("nope" as never)).toThrow("Unexpected value");
  });
});
