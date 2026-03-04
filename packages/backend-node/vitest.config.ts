import { defineConfig } from "vitest/config";

import { resolveExpectedCspiceToolkitVersion } from "./test/cspice-toolkit-version.js";

const expectedVersion = resolveExpectedCspiceToolkitVersion(
  process.env.TSPICE_EXPECTED_CSPICE_VERSION,
);

export default defineConfig({
  test: {
    env: {
      TSPICE_EXPECTED_CSPICE_VERSION: expectedVersion,
    },
  },
});
