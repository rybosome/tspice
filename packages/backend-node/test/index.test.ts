import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";

function getExpectedCspiceToolkitVersion(): string {
  const value = process.env.TSPICE_EXPECTED_CSPICE_VERSION;
  if (!value) {
    throw new Error(
      "Missing TSPICE_EXPECTED_CSPICE_VERSION. This should be provided by the test runner."
    );
  }
  return value;
}

const toolkitVersion = getExpectedCspiceToolkitVersion();

describe("@rybosome/tspice-backend-node", () => {
  it("loads the native addon", () => {
    const version = spiceVersion();
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });

  it("creates a backend", () => {
    const backend = createNodeBackend();
    expect(backend.kind).toBe("node");
    const version = backend.spiceVersion();
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });
});
