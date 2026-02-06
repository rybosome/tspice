import { describe, expect, it } from "vitest";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";
import { resolveExpectedCspiceToolkitVersion } from "./cspice-toolkit-version.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const toolkitVersion = resolveExpectedCspiceToolkitVersion(
  process.env.TSPICE_EXPECTED_CSPICE_VERSION,
);

describe("@rybosome/tspice-backend-node", () => {
  const itNative = it.runIf(nodeAddonAvailable());

  const itCI = it.runIf(process.env.CI === "true");
  itCI("CI sanity: native addon should be present", () => {
    expect(nodeAddonAvailable()).toBe(true);
  });

  itNative("loads the native addon", () => {
    const version = spiceVersion();
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });

  itNative("creates a backend", () => {
    const backend = createNodeBackend();
    expect(backend.kind).toBe("node");
    const version = backend.tkvrsn("TOOLKIT");
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });
});
