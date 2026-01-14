import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";

describe("@rybosome/tspice-backend-node", () => {
  it("loads the native addon", () => {
    expect(spiceVersion()).toBe("cspice-stub");
  });

  it("creates a backend", () => {
    const backend = createNodeBackend();
    expect(backend.kind).toBe("node");
    expect(backend.spiceVersion()).toBe("cspice-stub");
  });
});
