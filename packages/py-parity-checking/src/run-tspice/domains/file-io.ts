import type {
  DlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";

import type {
  PathRefLike,
  StepFileIoDafbfs,
  StepFileIoDafcls,
  StepFileIoDaffna,
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
import { toVirtualKernelPath } from "../../fixtures.js";
import type { FileIoHandleState, RunTspiceContext } from "../context.js";

type FileIoStep =
  | StepFileIoExists
  | StepFileIoGetfat
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

const SPAIX_HEAD_LIMIT = 8;

function resolveFileIoPath(path: PathRefLike): string {
  return toVirtualKernelPath(path);
}

function requireHandleState(context: RunTspiceContext, handleId: string): FileIoHandleState {
  const state = context.fileIoHandles.get(handleId);
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
  const existing = context.fileIoHandles.get(handleId);
  if (existing?.isOpen) {
    throw new Error(`File-io handle already exists and is open: ${handleId}`);
  }

  context.fileIoHandles.set(handleId, {
    handle,
    closeWith,
    isOpen: true,
  });
}

function requireDescriptor(context: RunTspiceContext, descrId: string): DlaDescriptor {
  const descr = context.fileIoDescrs.get(descrId);
  if (descr == null) {
    throw new Error(`File-io descriptor does not exist: ${descrId}`);
  }

  return descr;
}

function requireSpatialIndex(
  context: RunTspiceContext,
  spaixId: string,
): { spaixd: number[]; spaixi: number[] } {
  const index = context.fileIoSpatialIndexes.get(spaixId);
  if (index == null) {
    throw new Error(`File-io spatial index does not exist: ${spaixId}`);
  }

  return index;
}

function summarizeSpatialIndex(spaixd: number[], spaixi: number[]): {
  spaixdLength: number;
  spaixiLength: number;
  spaixdHead: number[];
  spaixiHead: number[];
} {
  return {
    spaixdLength: spaixd.length,
    spaixiLength: spaixi.length,
    spaixdHead: spaixd.slice(0, SPAIX_HEAD_LIMIT),
    spaixiHead: spaixi.slice(0, SPAIX_HEAD_LIMIT),
  };
}

/** Execute one `file-io.*` workflow step in tspice. */
export function runFileIoStep(context: RunTspiceContext, step: FileIoStep): StepOutput {
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

    case "file-io.dafopr": {
      const handle = context.spice.raw.dafopr(resolveFileIoPath(step.path));
      registerHandleState(context, step.handleId, handle, "dafcls");
      return { op: step.op, value: null };
    }

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
        context.fileIoDescrs.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.fileIoDescrs.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true } };
    }

    case "file-io.dlafns": {
      const state = requireHandleState(context, step.handleId);
      const descr = requireDescriptor(context, step.descrId);
      const out = context.spice.raw.dlafns(state.handle, descr);
      if (!out.found) {
        context.fileIoDescrs.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.fileIoDescrs.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true } };
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
        context.fileIoSpatialIndexes.set(step.spaixId, { spaixd, spaixi });
      }

      return {
        op: step.op,
        value: summarizeSpatialIndex(spaixd, spaixi),
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
