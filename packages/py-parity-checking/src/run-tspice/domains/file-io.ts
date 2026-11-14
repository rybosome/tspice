import type {
  DlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";

import type {
  PathRefLike,
  StepFileIoDafbfs,
  StepFileIoDafcls,
  StepFileIoDaffna,
  StepFileIoDafbbs,
  StepFileIoDafcs,
  StepFileIoDaffpa,
  StepFileIoDafgh,
  StepFileIoDafgn,
  StepFileIoDafgs,
  StepFileIoDafhsf,
  StepFileIoDafopw,
  StepFileIoDafopr,
  StepFileIoDascls,
  StepFileIoDasopr,
  StepFileIoDlabfs,
  StepFileIoDlacls,
  StepFileIoDlafns,
  StepFileIoDlaopn,
  StepFileIoDskmi2,
  StepFileIoDskopn,
  StepFileIoDskw02,
  StepFileIoExists,
  StepFileIoGetfat,
  StepOutput,
} from "../../case-types.js";
import {
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath,
} from "../../fixtures.js";
import type { RunTspiceContext } from "../context.js";

type FileIoStep =
  | StepFileIoExists
  | StepFileIoGetfat
  | StepFileIoDafbbs
  | StepFileIoDafcs
  | StepFileIoDaffpa
  | StepFileIoDafgh
  | StepFileIoDafgn
  | StepFileIoDafgs
  | StepFileIoDafhsf
  | StepFileIoDafopw
  | StepFileIoDafopr
  | StepFileIoDafcls
  | StepFileIoDafbfs
  | StepFileIoDaffna
  | StepFileIoDasopr
  | StepFileIoDascls
  | StepFileIoDlaopn
  | StepFileIoDlabfs
  | StepFileIoDlafns
  | StepFileIoDlacls
  | StepFileIoDskopn
  | StepFileIoDskmi2
  | StepFileIoDskw02;

function resolveFileIoPath(path: PathRefLike): string {
  return toVirtualKernelPath(path);
}

function requireHandleState(context: RunTspiceContext, handleId: string) {
  const state = context.state.fileIo.handles.get(handleId);
  if (state == null) {
    throw new Error(`File-io handle does not exist: ${handleId}`);
  }

  return state;
}

function registerHandleState(
  context: RunTspiceContext,
  handleId: string,
  handle: SpiceHandle,
  closeWith: "dafcls" | "dascls",
): void {
  const existing = context.state.fileIo.handles.get(handleId);
  if (existing?.isOpen) {
    throw new Error(`File-io handle already exists and is open: ${handleId}`);
  }

  context.state.fileIo.handles.set(handleId, {
    handle,
    closeWith,
    isOpen: true,
  });
}

function requireDescriptor(
  context: RunTspiceContext,
  descrId: string,
): DlaDescriptor {
  const descr = context.state.fileIo.descriptors.get(descrId);
  if (descr == null) {
    throw new Error(`File-io descriptor does not exist: ${descrId}`);
  }

  return descr;
}

function requireSpatialIndex(
  context: RunTspiceContext,
  spaixId: string,
): { spaixd: number[]; spaixi: number[] } {
  const index = context.state.fileIo.spatialIndexes.get(spaixId);
  if (index == null) {
    throw new Error(`File-io spatial index does not exist: ${spaixId}`);
  }

  return index;
}

/** Execute one `file-io.*` workflow step in tspice. */
export function runFileIoStep(
  context: RunTspiceContext,
  step: FileIoStep,
): StepOutput {
  switch (step.op) {
    case "file-io.exists":
      return {
        op: step.op,
        value: context.spice.raw.exists(resolveFileIoPath(step.path)),
      };

    case "file-io.getfat":
      return {
        op: step.op,
        value: context.spice.raw.getfat(resolveFileIoPath(step.path)),
      };

    case "file-io.dafopr":
    case "file-io.dafopw": {
      if (context.state.fileIo.handles.get(step.handleId)?.isOpen)
        throw new Error(
          `File-io handle already exists and is open: ${step.handleId}`,
        );
      const ref = toPathRef(step.path);
      if (step.op === "file-io.dafopw" && ref.kind !== "scratch")
        throw new Error("DAF write access requires a case scratch path");
      // Node writers create the physical scratch file. WASM writers and
      // staged read-only fixtures use the virtual kernel filesystem.
      const path =
        ref.kind === "scratch" && context.spice.raw.kind === "node"
          ? resolvePathRef(context.paths, ref)
          : toVirtualKernelPath(ref);
      const handle =
        step.op === "file-io.dafopw"
          ? context.spice.raw.dafopw(path)
          : context.spice.raw.dafopr(path);
      registerHandleState(context, step.handleId, handle, "dafcls");
      return { op: step.op, value: null };
    }

    case "file-io.dafgh": {
      const current = context.spice.raw.dafgh();
      for (const [handleId, entry] of context.state.fileIo.handles) {
        if (
          entry.isOpen &&
          entry.closeWith === "dafcls" &&
          entry.handle === current
        )
          return { op: step.op, value: { handleId } };
      }
      throw new Error(
        "No workflow handle matches the locally owned current DAF token",
      );
    }

    case "file-io.dafbbs":
    case "file-io.dafcs": {
      const { handle } = requireHandleState(context, step.handleId);
      if (step.op === "file-io.dafbbs") context.spice.raw.dafbbs(handle);
      else context.spice.raw.dafcs(handle);
      return { op: step.op, value: null };
    }

    case "file-io.daffpa":
      return {
        op: step.op,
        value: context.spice.raw.daffpa(
          requireHandleState(context, step.handleId).handle,
        ),
      };
    case "file-io.dafgn": {
      const { handle } = requireHandleState(context, step.handleId);
      let value: string;
      try {
        value = context.spice.raw.dafgn(handle, step.namlen);
      } catch (error) {
        if (
          step.captureError &&
          typeof error === "object" &&
          error !== null &&
          "spiceShort" in error &&
          typeof error.spiceShort === "string"
        )
          return { op: step.op, value: { short: error.spiceShort } };
        throw error;
      }
      if (step.captureError)
        throw new Error("DAFGN did not raise the expected toolkit error");
      return { op: step.op, value };
    }
    case "file-io.dafgs":
      return {
        op: step.op,
        value: Array.from(
          context.spice.raw.dafgs(
            requireHandleState(context, step.handleId).handle,
          ),
        ),
      };
    case "file-io.dafhsf":
      return {
        op: step.op,
        value: context.spice.raw.dafhsf(
          requireHandleState(context, step.handleId).handle,
        ),
      };

    case "file-io.dafcls": {
      const state = requireHandleState(context, step.handleId);
      context.spice.raw.dafcls(state.handle);
      state.isOpen = false;
      return { op: step.op, value: null };
    }

    case "file-io.dafbfs": {
      const state = requireHandleState(context, step.handleId);
      context.spice.raw.dafbfs(state.handle);
      return { op: step.op, value: null };
    }

    case "file-io.daffna": {
      const state = requireHandleState(context, step.handleId);
      return {
        op: step.op,
        value: context.spice.raw.daffna(state.handle),
      };
    }

    case "file-io.dasopr": {
      const handle = context.spice.raw.dasopr(resolveFileIoPath(step.path));
      registerHandleState(context, step.handleId, handle, "dascls");
      return { op: step.op, value: null };
    }

    case "file-io.dascls": {
      const state = requireHandleState(context, step.handleId);
      context.spice.raw.dascls(state.handle);
      state.isOpen = false;
      return { op: step.op, value: null };
    }

    case "file-io.dlaopn": {
      const handle = context.spice.raw.dlaopn(
        resolveFileIoPath(step.path),
        step.ftype,
        step.ifname,
        step.ncomch,
      );
      registerHandleState(context, step.handleId, handle, "dascls");
      return { op: step.op, value: null };
    }

    case "file-io.dlabfs": {
      const state = requireHandleState(context, step.handleId);
      const out = context.spice.raw.dlabfs(state.handle);
      if (!out.found) {
        context.state.fileIo.descriptors.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.state.fileIo.descriptors.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true, descr: out.descr } };
    }

    case "file-io.dlafns": {
      const state = requireHandleState(context, step.handleId);
      const descr = requireDescriptor(context, step.descrId);
      const out = context.spice.raw.dlafns(state.handle, descr);
      if (!out.found) {
        context.state.fileIo.descriptors.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.state.fileIo.descriptors.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true, descr: out.descr } };
    }

    case "file-io.dlacls": {
      const state = requireHandleState(context, step.handleId);
      context.spice.raw.dlacls(state.handle);
      state.isOpen = false;
      return { op: step.op, value: null };
    }

    case "file-io.dskopn": {
      const handle = context.spice.raw.dskopn(
        resolveFileIoPath(step.path),
        step.ifname,
        step.ncomch,
      );
      registerHandleState(context, step.handleId, handle, "dascls");
      return { op: step.op, value: null };
    }

    case "file-io.dskmi2": {
      const out = context.spice.raw.dskmi2(
        step.nv,
        step.vrtces,
        step.np,
        step.plates,
        step.finscl,
        step.corscl,
        step.worksz,
        step.voxpsz,
        step.voxlsz,
        step.makvtl,
        step.spxisz,
      );

      const spaixd = [...out.spaixd];
      const spaixi = [...out.spaixi];
      if (step.spaixId != null) {
        context.state.fileIo.spatialIndexes.set(step.spaixId, {
          spaixd,
          spaixi,
        });
      }

      return {
        op: step.op,
        value: { spaixd, spaixi },
      };
    }

    case "file-io.dskw02": {
      const state = requireHandleState(context, step.handleId);
      const index = requireSpatialIndex(context, step.spaixId);
      context.spice.raw.dskw02(
        state.handle,
        step.center,
        step.surfid,
        step.dclass,
        step.frame,
        step.corsys,
        step.corpar,
        step.mncor1,
        step.mxcor1,
        step.mncor2,
        step.mxcor2,
        step.mncor3,
        step.mxcor3,
        step.first,
        step.last,
        step.nv,
        step.vrtces,
        step.np,
        step.plates,
        index.spaixd,
        index.spaixi,
      );
      return { op: step.op, value: null };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled file-io step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
