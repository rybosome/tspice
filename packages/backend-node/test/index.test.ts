import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createNodeBackend, spiceVersion } from "@rybosome/tspice-backend-node";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const cspiceManifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
const { toolkitVersion } = JSON.parse(fs.readFileSync(cspiceManifestPath, "utf8"));

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
