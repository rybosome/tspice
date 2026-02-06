import { describe, expect, it } from "vitest";

import { InvariantError } from "@rybosome/tspice-core";

import { assertLength3, assertLength36 } from "../src/codec/arrays.js";

describe("backend-node codec array validators", () => {
  it("throws InvariantError on length mismatch", () => {
    expect(() => assertLength3([1, 2] as unknown, "testVec3")).toThrow(InvariantError);
    expect(() => assertLength36(Array.from({ length: 35 }, () => 0) as unknown, "testMat6")).toThrow(
      InvariantError,
    );
  });

  it("throws InvariantError on non-finite values", () => {
    expect(() => assertLength3([1, 2, Infinity] as unknown, "testVec3")).toThrow(InvariantError);
    expect(() => assertLength3([1, 2, NaN] as unknown, "testVec3")).toThrow(InvariantError);
  });
});
