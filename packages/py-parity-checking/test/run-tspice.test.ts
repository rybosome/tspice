import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import type { Spice } from "@rybosome/tspice";

import type { ParityCase } from "../src/case-types.js";
import { cleanupContext, createRunTspiceContext } from "../src/run-tspice/context.js";
import { runEphemerisStep } from "../src/run-tspice/domains/ephemeris.js";
import { runTspicePostCaseHooks } from "../src/run-tspice/post-case.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { createEmptyWorkflowNormalizationMetadata } from "../src/workflow-normalization/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "..", "fixtures");

function asSpiceHandle(value: number): SpiceHandle {
  return value as unknown as SpiceHandle;
}

function createSpiceMock(): {
  spice: Spice;
  raw: {
    kclear: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    dafcls: ReturnType<typeof vi.fn>;
    dascls: ReturnType<typeof vi.fn>;
  };
} {
  const raw = {
    kclear: vi.fn(),
    reset: vi.fn(),
    dafcls: vi.fn(),
    dascls: vi.fn(),
  };

  return {
    spice: { raw } as unknown as Spice,
    raw,
  };
}

describe("run-tspice post-case hooks", () => {
  it("is a no-op when post-case metadata is empty", () => {
    const { spice, raw } = createSpiceMock();
    const context = createRunTspiceContext(spice, fixturesRoot, `post-case-empty-${Date.now()}`);

    try {
      context.state.fileIo.handles.set("open", {
        handle: asSpiceHandle(101),
        closeWith: "dafcls",
        isOpen: true,
      });

      runTspicePostCaseHooks(context, createEmptyWorkflowNormalizationMetadata());

      expect(raw.dafcls).not.toHaveBeenCalled();
      expect(raw.dascls).not.toHaveBeenCalled();
      expect(context.state.fileIo.handles.size).toBe(1);
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });

  it("closes open handles best-effort via closeWith semantics and clears file-io maps", () => {
    const { spice, raw } = createSpiceMock();
    const context = createRunTspiceContext(spice, fixturesRoot, `post-case-close-${Date.now()}`);

    try {
      context.state.fileIo.handles.set("daf-open", {
        handle: asSpiceHandle(11),
        closeWith: "dafcls",
        isOpen: true,
      });
      context.state.fileIo.handles.set("das-open", {
        handle: asSpiceHandle(22),
        closeWith: "dascls",
        isOpen: true,
      });
      context.state.fileIo.handles.set("already-closed", {
        handle: asSpiceHandle(33),
        closeWith: "dascls",
        isOpen: false,
      });
      context.state.fileIo.descriptors.set("descriptor", {
        bwdptr: 0,
        fwdptr: 0,
        ibase: 0,
        isize: 0,
        dbase: 0,
        dsize: 0,
        cbase: 0,
        csize: 0,
      });
      context.state.fileIo.spatialIndexes.set("index", { spaixd: [1], spaixi: [2] });

      const metadata = createEmptyWorkflowNormalizationMetadata();
      metadata.postCase.cleanupScopes.push({
        domain: "file-io",
        scope: "open-handles",
      });

      runTspicePostCaseHooks(context, metadata);

      expect(raw.dafcls).toHaveBeenCalledTimes(1);
      expect(raw.dafcls).toHaveBeenCalledWith(11);
      expect(raw.dascls).toHaveBeenCalledTimes(1);
      expect(raw.dascls).toHaveBeenCalledWith(22);

      expect(context.state.fileIo.handles.size).toBe(0);
      expect(context.state.fileIo.descriptors.size).toBe(0);
      expect(context.state.fileIo.spatialIndexes.size).toBe(0);
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });

  it("cleanupContext no longer owns file-io handle cleanup", () => {
    const { spice, raw } = createSpiceMock();
    const context = createRunTspiceContext(spice, fixturesRoot, `context-cleanup-${Date.now()}`);

    try {
      context.state.fileIo.handles.set("open", {
        handle: asSpiceHandle(707),
        closeWith: "dafcls",
        isOpen: true,
      });

      cleanupContext(context);

      expect(raw.dafcls).not.toHaveBeenCalled();
      expect(raw.dascls).not.toHaveBeenCalled();
      expect(context.state.fileIo.handles.size).toBe(1);
      expect(raw.kclear).toHaveBeenCalledTimes(1);
      expect(raw.reset).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });
});

describe("runCaseInTspice", () => {
  it("cleans up scratch context when workflow normalization throws", () => {
    const caseId = `normalization-cleanup-${Date.now()}`;
    const scratchPrefix = `py-parity-${caseId}-`;

    const before = fs
      .readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(scratchPrefix));
    expect(before).toHaveLength(0);

    const kclear = vi.fn();
    const reset = vi.fn();
    const spice = {
      raw: {
        kclear,
        reset,
      },
    } as unknown as Spice;

    const parityCase: ParityCase = {
      caseId,
      description: "normalization failure should still clean up runtime context",
      expectation: { kind: "error" },
      workflow: [
        {
          op: "kernels.kinfo",
          path: "kernels/naif0012.tls",
          alias: "missing-alias",
        },
      ],
    };

    const result = runCaseInTspice(spice, parityCase, fixturesRoot);

    expect(result).toEqual({
      caseId,
      ok: false,
      outputs: [],
      error: {
        type: "Error",
        message: "Workflow alias not found: missing-alias",
      },
    });
    expect(kclear).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(2);

    const after = fs
      .readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(scratchPrefix));
    expect(after).toHaveLength(0);
  });
});

describe("runEphemerisStep path resolution", () => {
  it("uses absolute scratch paths for node ephemeris writers", () => {
    const spkopn = vi.fn(() => asSpiceHandle(9001));
    const spice = {
      raw: {
        kind: "node",
        spkopn,
      },
    } as unknown as Spice;

    const context = createRunTspiceContext(spice, fixturesRoot, `ephemeris-node-writer-${Date.now()}`);
    const relPath = "nested/output/new-segment.bsp";

    try {
      const result = runEphemerisStep(context, {
        op: "ephemeris.spkopn",
        file: { kind: "scratch", rel: relPath },
        ifname: "TEST",
        ncomch: 0,
        handleId: "writer",
      });

      const expectedPath = path.join(context.paths.scratchRoot, "nested", "output", "new-segment.bsp");
      expect(spkopn).toHaveBeenCalledWith(expectedPath, "TEST", 0);
      expect(fs.existsSync(path.dirname(expectedPath))).toBe(true);
      expect(result).toEqual({
        op: "ephemeris.spkopn",
        value: { handleId: "writer" },
      });
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });

  it("uses absolute scratch paths for node ephemeris readers", () => {
    const spkobj = vi.fn();
    const card = vi.fn(() => 0);
    const newIntCell = vi.fn(() => ({}) as ReturnType<Spice["kit"]["newIntCell"]>);
    const freeCell = vi.fn();
    const cellGeti = vi.fn();
    const spice = {
      raw: {
        kind: "node",
        spkobj,
        card,
      },
      kit: {
        newIntCell,
        freeCell,
        cellGeti,
      },
    } as unknown as Spice;

    const context = createRunTspiceContext(spice, fixturesRoot, `ephemeris-node-reader-${Date.now()}`);
    const relPath = "generated/from-node.bsp";

    try {
      const result = runEphemerisStep(context, {
        op: "ephemeris.spkobj",
        spk: { kind: "scratch", rel: relPath },
        idsCellId: "ids",
      });

      const expectedPath = path.join(context.paths.scratchRoot, "generated", "from-node.bsp");
      expect(spkobj).toHaveBeenCalledWith(expectedPath, expect.anything());
      expect(result).toEqual({
        op: "ephemeris.spkobj",
        value: { ids: [] },
      });
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });

  it("preserves virtual scratch paths for wasm ephemeris writers", () => {
    const spkopn = vi.fn(() => asSpiceHandle(7331));
    const spice = {
      raw: {
        kind: "wasm",
        spkopn,
      },
    } as unknown as Spice;

    const context = createRunTspiceContext(spice, fixturesRoot, `ephemeris-wasm-writer-${Date.now()}`);

    try {
      runEphemerisStep(context, {
        op: "ephemeris.spkopn",
        file: { kind: "scratch", rel: "new-output.bsp" },
        ifname: "TEST",
        ncomch: 0,
        handleId: "writer",
      });

      expect(spkopn).toHaveBeenCalledWith("py-parity/scratch/new-output.bsp", "TEST", 0);
    } finally {
      fs.rmSync(context.paths.scratchRoot, { recursive: true, force: true });
    }
  });
});
