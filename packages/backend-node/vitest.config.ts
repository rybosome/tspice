import { defineConfig } from "vitest/config";

import { DEFAULT_CSPICE_TOOLKIT_VERSION } from "./test/cspice-toolkit-version.js";

export default defineConfig({
  test: {
    env: {
      TSPICE_EXPECTED_CSPICE_VERSION:
        process.env.TSPICE_EXPECTED_CSPICE_VERSION ?? DEFAULT_CSPICE_TOOLKIT_VERSION,
    },
  },
});
