import { describe, expect, it } from "vitest";

import type { WorkflowStep } from "../src/case-types.js";
import { withNormalizedWorkflowPathRefs } from "../src/runtime/workflow-paths.js";

describe("workflow path normalization", () => {
  it("promotes kernels.furnsh strings to scratch refs when workflow creates EK file", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "ek.ekopn",
        path: ".py-parity-ek-scratch.ek",
        ifname: "wf-test",
        ncomch: 0,
        handleId: "H_TEST",
      },
      { op: "ek.ekcls", handleId: "H_TEST" },
      { op: "kernels.furnsh", file: ".py-parity-ek-scratch.ek" },
    ];

    const normalized = withNormalizedWorkflowPathRefs(workflow);

    expect(normalized[2]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "scratch",
        rel: ".py-parity-ek-scratch.ek",
      },
    });
  });

  it("keeps non-EK kernels.furnsh strings fixture-relative", () => {
    const workflow: WorkflowStep[] = [{ op: "kernels.furnsh", file: "kernels/naif0012.tls" }];

    const normalized = withNormalizedWorkflowPathRefs(workflow);

    expect(normalized[0]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "fixture",
        rel: "kernels/naif0012.tls",
      },
    });
  });

  it("normalizes explicit path refs unchanged in meaning", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "kernels.furnsh",
        file: {
          kind: "scratch",
          rel: "tmp/../tmp/generated.ek",
        },
      },
    ];

    const normalized = withNormalizedWorkflowPathRefs(workflow);

    expect(normalized[0]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "scratch",
        rel: "tmp/generated.ek",
      },
    });
  });
});
