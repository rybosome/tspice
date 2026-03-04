import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

import { resolveExpectedCspiceToolkitVersion } from "./test/cspice-toolkit-version.js";

const expectedVersion = resolveExpectedCspiceToolkitVersion(
  process.env.TSPICE_EXPECTED_CSPICE_VERSION,
);

export default defineConfig({
  resolve: {
    // Avoid package self-reference resolution differences across Node/Vitest
    // versions during in-package tests.
    alias: {
      "@rybosome/tspice-backend-node": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    env: {
      TSPICE_EXPECTED_CSPICE_VERSION: expectedVersion,
    },
  },
});
