import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";
import { DEFAULT_CSPICE_TOOLKIT_VERSION } from "./cspice-toolkit-version.js";

const toolkitVersion = process.env.TSPICE_EXPECTED_CSPICE_VERSION ?? DEFAULT_CSPICE_TOOLKIT_VERSION;

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
