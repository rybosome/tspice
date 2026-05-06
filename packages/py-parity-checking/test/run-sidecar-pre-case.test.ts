import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runSidecarPreCaseHooks } from "../src/run-sidecar/pre-case.js";
import { createEmptyWorkflowNormalizationMetadata } from "../src/workflow-normalization/index.js";
import type { WorkflowNormalizationMetadata } from "../src/workflow-normalization/types.js";

function createRuntimeRoots(seed: string): { fixturesRoot: string; scratchRoot: string } {
  return {
    fixturesRoot: fs.mkdtempSync(path.join(os.tmpdir(), `${seed}-fixtures-`)),
    scratchRoot: fs.mkdtempSync(path.join(os.tmpdir(), `${seed}-scratch-`)),
  };
}

describe("runSidecarPreCaseHooks", () => {
  it("is a no-op when metadata has no cleanup candidates", () => {
    const roots = createRuntimeRoots("pre-case-empty");
    try {
      expect(() =>
        runSidecarPreCaseHooks(createEmptyWorkflowNormalizationMetadata(), roots),
      ).not.toThrow();
    } finally {
      fs.rmSync(roots.fixturesRoot, { recursive: true, force: true });
      fs.rmSync(roots.scratchRoot, { recursive: true, force: true });
    }
  });

  it("dedupes deletes and ignores out-of-policy cleanup candidates", () => {
    const roots = createRuntimeRoots("pre-case-policy");
    const allowedFile = path.join(roots.fixturesRoot, "kernels/generated/delete-me.dla");
    const outsidePrefixFile = path.join(roots.fixturesRoot, "kernels/keep-me.dla");
    const unsupportedExtensionFile = path.join(roots.fixturesRoot, "kernels/generated/keep-me.txt");
    const scratchFile = path.join(roots.scratchRoot, "generated/keep-me.bds");
    const directoryCandidate = path.join(roots.fixturesRoot, "kernels/generated/dir-only.bds");

    const cleanupMetadata: WorkflowNormalizationMetadata = {
      preCase: {
        cleanupCandidates: [
          {
            domain: "file-io",
            op: "file-io.dlaopn",
            path: { kind: "fixture", rel: "kernels/generated/delete-me.dla" },
          },
          {
            domain: "file-io",
            op: "file-io.dskopn",
            path: { kind: "fixture", rel: "kernels/generated/delete-me.dla" },
          },
          {
            domain: "file-io",
            op: "file-io.dlaopn",
            path: { kind: "fixture", rel: "kernels/keep-me.dla" },
          },
          {
            domain: "file-io",
            op: "file-io.dskopn",
            path: { kind: "fixture", rel: "kernels/generated/keep-me.txt" },
          },
          {
            domain: "file-io",
            op: "file-io.dskopn",
            path: { kind: "scratch", rel: "generated/keep-me.bds" },
          },
          {
            domain: "file-io",
            op: "file-io.dskopn",
            path: { kind: "fixture", rel: "kernels/generated/dir-only.bds" },
          },
        ],
      },
      postCase: {
        cleanupScopes: [],
      },
      runtimePath: {
        canonicalizationHints: [],
      },
    };

    fs.mkdirSync(path.dirname(allowedFile), { recursive: true });
    fs.writeFileSync(allowedFile, "delete");
    fs.writeFileSync(outsidePrefixFile, "keep");
    fs.writeFileSync(unsupportedExtensionFile, "keep");
    fs.mkdirSync(path.dirname(scratchFile), { recursive: true });
    fs.writeFileSync(scratchFile, "keep");
    fs.mkdirSync(directoryCandidate, { recursive: true });

    const unlinkSpy = vi.spyOn(fs, "unlinkSync");
    try {
      runSidecarPreCaseHooks(cleanupMetadata, roots);

      expect(unlinkSpy).toHaveBeenCalledTimes(1);
      expect(unlinkSpy).toHaveBeenCalledWith(allowedFile);

      expect(fs.existsSync(allowedFile)).toBe(false);
      expect(fs.existsSync(outsidePrefixFile)).toBe(true);
      expect(fs.existsSync(unsupportedExtensionFile)).toBe(true);
      expect(fs.existsSync(scratchFile)).toBe(true);
      expect(fs.statSync(directoryCandidate).isDirectory()).toBe(true);
    } finally {
      unlinkSpy.mockRestore();
      fs.rmSync(roots.fixturesRoot, { recursive: true, force: true });
      fs.rmSync(roots.scratchRoot, { recursive: true, force: true });
    }
  });
});
