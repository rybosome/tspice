import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";
import { resolveExpectedCspiceToolkitVersion } from "./cspice-toolkit-version.js";

const toolkitVersion = resolveExpectedCspiceToolkitVersion(
  process.env.TSPICE_EXPECTED_CSPICE_VERSION,
);

describe("@rybosome/tspice-backend-node", () => {
  it("loads the native addon", () => {
    const version = spiceVersion();
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });

  it("creates a backend", () => {
    const backend = createNodeBackend();
    expect(backend.kind).toBe("node");
    const version = backend.tkvrsn("TOOLKIT");
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });
});
