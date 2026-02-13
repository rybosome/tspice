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
    expect(backend.kind).toBe("wasm");
    const version = backend.tkvrsn("TOOLKIT");
    expect(version).not.toBe("");
    expect(version).toContain(toolkitVersion);
  });

  it("swpool allows an empty names list", async () => {
    const backend = await createWasmBackend();

    // Before any watch is set up, most agents will report no update.
    // (Exact initial state is not critical; we mainly care that swpool([]) doesn't throw
    // and that cvpool toggles as documented.)
    backend.swpool("AGENT", []);

    expect(backend.cvpool("AGENT")).toBe(true);
    expect(backend.cvpool("AGENT")).toBe(false);
  });
});
