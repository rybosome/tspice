import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");
const cspiceManifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
const { toolkitVersion } = JSON.parse(fs.readFileSync(cspiceManifestPath, "utf8"));

describe("@rybosome/tspice-backend-wasm", () => {
  it("loads the wasm module", async () => {
    const backend = await createWasmBackend();
    const version = backend.tkvrsn("TOOLKIT");
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });
});
