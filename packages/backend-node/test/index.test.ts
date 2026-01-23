import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { resolveExpectedCspiceToolkitVersion } from "./cspice-toolkit-version.js";

const toolkitVersion = resolveExpectedCspiceToolkitVersion(
  process.env.TSPICE_EXPECTED_CSPICE_VERSION,
);

const defaultBindingPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../native/build/Release/tspice_backend_node.node",
);

const bindingPath =
  process.env.TSPICE_BACKEND_NODE_BINDING_PATH ?? defaultBindingPath;

const runNativeTests = process.env.TSPICE_RUN_NODE_BACKEND_TESTS === "1";
const bindingExists = fs.existsSync(bindingPath);

if (!runNativeTests) {
  // These tests are intentionally disabled in the JS lane.
  // Enable them in the native lane via `TSPICE_RUN_NODE_BACKEND_TESTS=1`.
  //
  // Note: we log rather than fail so the JS lane stays green.
  // The native lane should set the env var and build the addon.
  console.warn(
    "Skipping @rybosome/tspice-backend-node native tests (set TSPICE_RUN_NODE_BACKEND_TESTS=1 to enable).",
  );
} else if (!bindingExists) {
  console.warn(
    `Skipping @rybosome/tspice-backend-node native tests (native addon not found at ${bindingPath}).`,
  );
}

const shouldRun = runNativeTests && bindingExists;
const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("@rybosome/tspice-backend-node (native)", () => {
  let createNodeBackend: typeof import("@rybosome/tspice-backend-node").createNodeBackend;
  let spiceVersion: typeof import("@rybosome/tspice-backend-node").spiceVersion;

  beforeAll(async () => {
    ({ createNodeBackend, spiceVersion } = await import(
      "@rybosome/tspice-backend-node"
    ));
  });

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
