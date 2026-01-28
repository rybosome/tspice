import { describe, expect, it } from "vitest";

import { BACKEND_KINDS } from "@rybosome/tspice-backend-contract";

describe("@rybosome/tspice-backend-contract", () => {
  it("exports backend kinds", () => {
    expect(BACKEND_KINDS).toEqual(["auto", "node", "wasm", "fake"]);
  });
});
