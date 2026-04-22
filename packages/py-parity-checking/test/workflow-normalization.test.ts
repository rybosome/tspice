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

  it("normalizes file-io paths and resolves file-io publisher aliases", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "file-io.exists",
        path: "kernels/placeholder.bds",
        alias: "generated-dsk",
      },
      {
        op: "file-io.dskopn",
        path: { kind: "scratch", rel: "generated/file-io-alias.bds" },
        alias: "generated-dsk",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "writer",
      },
    ];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized).toEqual([
      {
        op: "file-io.exists",
        path: { kind: "scratch", rel: "generated/file-io-alias.bds" },
        alias: "generated-dsk",
      },
      {
        op: "file-io.dskopn",
        path: { kind: "scratch", rel: "generated/file-io-alias.bds" },
        alias: "generated-dsk",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "writer",
      },
    ]);
  });

  it("allows file-io consumers to reuse kernels aliases", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "file-io.getfat",
        path: "kernels/placeholder.bsp",
        alias: "fixture-kernel",
      },
      {
        op: "kernels.furnsh",
        file: "kernels/file-io-minimal.bsp",
        alias: "fixture-kernel",
      },
    ];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized).toEqual([
      {
        op: "file-io.getfat",
        path: { kind: "fixture", rel: "kernels/file-io-minimal.bsp" },
        alias: "fixture-kernel",
      },
      {
        op: "kernels.furnsh",
        file: { kind: "fixture", rel: "kernels/file-io-minimal.bsp" },
        alias: "fixture-kernel",
      },
    ]);
  });

  it("throws when multiple publishers define the same alias", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "kernels.furnsh",
        file: "kernels/naif0012.tls",
        alias: "shared-kernel",
      },
      {
        op: "kernels.furnsh",
        file: "kernels/pck00010.tpc",
        alias: "shared-kernel",
      },
    ];

    expect(() => normalizeWorkflow(workflow, "sidecar")).toThrowError(
      "Workflow alias already published: shared-kernel",
    );
  });
});
