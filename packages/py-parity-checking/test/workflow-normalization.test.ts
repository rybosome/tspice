import { describe, expect, it } from "vitest";

import type { WorkflowStep } from "../src/case-types.js";
import {
  normalizeWorkflow,
  normalizeWorkflowDetailed,
} from "../src/workflow-normalization/index.js";

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

  it("returns deterministic empty metadata lanes when no domain emits metadata", () => {
    const workflow: WorkflowStep[] = [{ op: "kernels.furnsh", file: "kernels/naif0012.tls" }];

    const firstPass = normalizeWorkflowDetailed(workflow, "sidecar");
    const secondPass = normalizeWorkflowDetailed(workflow, "sidecar");

    expect(firstPass).toEqual(secondPass);
    expect(firstPass.metadata).toEqual({
      preCase: { cleanupCandidates: [] },
      postCase: { cleanupScopes: [] },
      runtimePath: { canonicalizationHints: [] },
    });
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

  it("emits file-io writer cleanup candidates with alias-before-emission behavior", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "file-io.exists",
        path: "kernels/generated/placeholder.bds",
        alias: "generated-dsk",
      },
      {
        op: "file-io.dskopn",
        path: "kernels/generated/file-io-alias.bds",
        alias: "generated-dsk",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "writer",
      },
    ];

    const normalized = normalizeWorkflowDetailed(workflow, "sidecar");

    expect(normalized.workflow).toEqual([
      {
        op: "file-io.exists",
        path: { kind: "fixture", rel: "kernels/generated/file-io-alias.bds" },
        alias: "generated-dsk",
      },
      {
        op: "file-io.dskopn",
        path: { kind: "fixture", rel: "kernels/generated/file-io-alias.bds" },
        alias: "generated-dsk",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "writer",
      },
    ]);

    expect(normalized.metadata.preCase.cleanupCandidates).toEqual([
      {
        domain: "file-io",
        op: "file-io.dskopn",
        path: { kind: "fixture", rel: "kernels/generated/file-io-alias.bds" },
      },
    ]);
    expect(normalized.metadata.postCase.cleanupScopes).toEqual([
      {
        domain: "file-io",
        scope: "open-handles",
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

  it("canonicalizes frames CK paths and emits runtime canonicalization hints", () => {
    const workflow: WorkflowStep[] = [
      { op: "frames.cklpf", ck: "kernels/mgs_hga_hinge_v2.bc", handleId: "h0" },
      {
        op: "frames.ckobj",
        ck: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
        idsId: "ids",
      },
      {
        op: "frames.ckcov",
        ck: "kernels/mgs_hga_hinge_v2.bc",
        idcode: -94031,
        needav: false,
        level: "INTERVAL",
        tol: 0,
        timsys: "TDB",
        coverId: "cov",
      },
    ];

    const normalized = normalizeWorkflowDetailed(workflow, "tspice");

    expect(normalized.workflow).toEqual([
      {
        op: "frames.cklpf",
        ck: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
        handleId: "h0",
      },
      {
        op: "frames.ckobj",
        ck: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
        idsId: "ids",
      },
      {
        op: "frames.ckcov",
        ck: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
        idcode: -94031,
        needav: false,
        level: "INTERVAL",
        tol: 0,
        timsys: "TDB",
        coverId: "cov",
      },
    ]);

    expect(normalized.metadata.runtimePath.canonicalizationHints).toEqual([
      {
        domain: "frames",
        op: "frames.cklpf",
        field: "ck",
        canonicalPath: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
      },
      {
        domain: "frames",
        op: "frames.ckobj",
        field: "ck",
        canonicalPath: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
      },
      {
        domain: "frames",
        op: "frames.ckcov",
        field: "ck",
        canonicalPath: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
      },
    ]);
  });

  it("keeps metadata ordering deterministic across domains", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "file-io.dlaopn",
        path: "kernels/generated/order-a.dla",
        ftype: "DAF/DLA",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "dla",
      },
      {
        op: "frames.ckcov",
        ck: "kernels/mgs_hga_hinge_v2.bc",
        idcode: -94031,
        needav: false,
        level: "INTERVAL",
        tol: 0,
        timsys: "TDB",
        coverId: "cov-order",
      },
      {
        op: "file-io.dskopn",
        path: "kernels/generated/order-b.bds",
        ifname: "TSPICE",
        ncomch: 0,
        handleId: "dsk",
      },
      {
        op: "frames.ckobj",
        ck: "kernels/mgs_hga_hinge_v2.bc",
        idsId: "ids-order",
      },
    ];

    const firstPass = normalizeWorkflowDetailed(workflow, "tspice");
    const secondPass = normalizeWorkflowDetailed(workflow, "tspice");

    expect(firstPass.metadata).toEqual(secondPass.metadata);
    expect(firstPass.metadata.preCase.cleanupCandidates).toEqual([
      {
        domain: "file-io",
        op: "file-io.dlaopn",
        path: { kind: "fixture", rel: "kernels/generated/order-a.dla" },
      },
      {
        domain: "file-io",
        op: "file-io.dskopn",
        path: { kind: "fixture", rel: "kernels/generated/order-b.bds" },
      },
    ]);
    expect(firstPass.metadata.postCase.cleanupScopes).toEqual([
      {
        domain: "file-io",
        scope: "open-handles",
      },
    ]);
    expect(firstPass.metadata.runtimePath.canonicalizationHints).toEqual([
      {
        domain: "frames",
        op: "frames.ckcov",
        field: "ck",
        canonicalPath: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
      },
      {
        domain: "frames",
        op: "frames.ckobj",
        field: "ck",
        canonicalPath: { kind: "fixture", rel: "kernels/mgs_hga_hinge_v2.bc" },
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

  it("marks kernels.furnsh EK outputs as scratch paths via shared generated-path context", () => {
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

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized[2]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "scratch",
        rel: ".py-parity-ek-scratch.ek",
      },
    });
  });

  it("normalizes EK generated-path lookups before matching kernels.furnsh strings", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "ek.ekopn",
        path: "tmp/../generated.ek",
        ifname: "wf-test",
        ncomch: 0,
        handleId: "H_TEST",
      },
      {
        op: "kernels.furnsh",
        file: "generated.ek",
      },
    ];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized[1]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "scratch",
        rel: "generated.ek",
      },
    });
  });

  it("keeps non-generated kernels.furnsh strings fixture-relative by default", () => {
    const workflow: WorkflowStep[] = [{ op: "kernels.furnsh", file: "kernels/naif0012.tls" }];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized[0]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "fixture",
        rel: "kernels/naif0012.tls",
      },
    });
  });

  it("normalizes explicit kernels.furnsh path refs unchanged in meaning", () => {
    const workflow: WorkflowStep[] = [
      {
        op: "kernels.furnsh",
        file: {
          kind: "scratch",
          rel: "tmp/../tmp/generated.ek",
        },
      },
    ];

    const normalized = normalizeWorkflow(workflow, "sidecar");

    expect(normalized[0]).toEqual({
      op: "kernels.furnsh",
      file: {
        kind: "scratch",
        rel: "tmp/generated.ek",
      },
    });
  });
});
