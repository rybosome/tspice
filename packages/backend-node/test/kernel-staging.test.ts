import { describe, expect, it } from "vitest";

import { createKernelStager } from "../src/runtime/kernel-staging.js";

describe("backend-node kernel staging", () => {
  it("resolvePath canonicalizes virtual kernel paths even when not staged", () => {
    const stager = createKernelStager();

    // Not staged, but still a recognized virtual path: return canonical `/kernels/...`.
    expect(stager.resolvePath("kernels/a.tm")).toBe("/kernels/a.tm");
    expect(stager.resolvePath("/kernels/a.tm")).toBe("/kernels/a.tm");
  });

  it("resolvePath leaves non-virtual paths unchanged", () => {
    const stager = createKernelStager();

    // Normal OS paths can contain `..` and should pass through untouched.
    expect(stager.resolvePath("../kernels/a.tm")).toBe("../kernels/a.tm");
  });
});
