import { describe, expect, it } from "vitest";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("native backend requirement", () => {
  it.runIf(process.env.TSPICE_EXPECT_NATIVE === "true")(
    "CI sanity: node backend should be present",
    () => {
      expect(
        nodeBackendAvailable,
        "TSPICE_EXPECT_NATIVE=true requires the Node backend entrypoint and production addon",
      ).toBe(true);
    },
  );
});
