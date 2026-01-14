import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      TSPICE_EXPECTED_CSPICE_VERSION: process.env.TSPICE_EXPECTED_CSPICE_VERSION ?? "N0067",
    },
  },
});
