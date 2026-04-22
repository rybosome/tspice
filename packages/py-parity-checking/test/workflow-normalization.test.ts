import { describe, expect, it } from "vitest";

import type { WorkflowStep } from "../src/case-types.js";
import { normalizeWorkflow } from "../src/workflow-normalization/index.js";

describe("workflow normalization", () => {
  it("normalizes deterministically without mutating input workflow", () => {
    const workflow: WorkflowStep[] = [
      { op: "kernels.furnsh", file: "kernels/naif0012.tls" },
      { op: "kernels.kinfo", path: "kernels/naif0012.tls" },
    ];

    const original = structuredClone(workflow);

    const firstPass = normalizeWorkflow(workflow, "sidecar");
    const secondPass = normalizeWorkflow(workflow, "sidecar");

    expect(firstPass).toEqual(secondPass);
    expect(firstPass).toEqual([
      {
        op: "kernels.furnsh",
        file: { kind: "fixture", rel: "kernels/naif0012.tls" },
      },
      {
        op: "kernels.kinfo",
        path: "kernels/naif0012.tls",
      },
    ]);
    expect(workflow).toEqual(original);
  });

  it("publishes aliases before consumer normalization regardless of step order", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "kernels.kinfo",
        path: "kernels/placeholder.tls",
        alias: "primary-kernel",
      },
      {
        op: "kernels.unload",
        path: "kernels/placeholder.tls",
        alias: "primary-kernel",
      },
      {
        op: "kernels.furnsh",
        file: "kernels/naif0012.tls",
        alias: "primary-kernel",
      },
    ];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized).toEqual([
      {
        op: "kernels.kinfo",
        path: "kernels/naif0012.tls",
        alias: "primary-kernel",
      },
      {
        op: "kernels.unload",
        path: "kernels/naif0012.tls",
        alias: "primary-kernel",
      },
      {
        op: "kernels.furnsh",
        file: { kind: "fixture", rel: "kernels/naif0012.tls" },
        alias: "primary-kernel",
      },
    ]);
  });
});
