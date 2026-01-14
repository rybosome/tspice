import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";

describe("@rybosome/tspice-backend-node", () => {
  it("loads the native addon", () => {
    const version = spiceVersion();
    expect(version).not.toBe("");
    expect(version).toMatch(/N\d{4}/);
  });

  it("creates a backend", () => {
    const backend = createNodeBackend();
    expect(backend.kind).toBe("node");
    const version = backend.spiceVersion();
    expect(version).not.toBe("");
    expect(version).toMatch(/N\d{4}/);
  });
});
