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
  StepFileIoDasadc,
  StepFileIoDasadd,
  StepFileIoDasadi,
  StepFileIoDasrdc,
  StepFileIoDasrdd,
  StepFileIoDasrdi,
  StepFileIoDasudc,
  StepFileIoDasudd,
  StepFileIoDasudi,
  StepFileIoDasonw,
  StepFileIoDasops,
  StepFileIoDasopw,
  StepFileIoDashfn,
  StepFileIoDashfs,
  StepFileIoDaslla,
  StepFileIoDasllc,
  StepFileIoDasrfr,
  StepFileIoDaswbr,
  StepFileIoDascls,
  StepFileIoDasopr,
  StepFileIoDlabbs,
  StepFileIoDlabns,
  StepFileIoDlaens,
  StepFileIoDlafps,
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
import { toPathRef, toVirtualKernelPath } from "../../fixtures.js";
import type { RunTspiceContext } from "../context.js";

type FileIoStep =
  | StepFileIoExists
  | StepFileIoGetfat
  | StepFileIoDafopr
  | StepFileIoDafcls
  | StepFileIoDafbfs
  | StepFileIoDaffna
  | StepFileIoDasopr
  | StepFileIoDasadc
  | StepFileIoDasadd
  | StepFileIoDasadi
  | StepFileIoDasrdc
  | StepFileIoDasrdd
  | StepFileIoDasrdi
  | StepFileIoDasudc
  | StepFileIoDasudd
  | StepFileIoDasudi
  | StepFileIoDasonw
  | StepFileIoDasops
  | StepFileIoDasopw
  | StepFileIoDashfn
  | StepFileIoDashfs
  | StepFileIoDaslla
  | StepFileIoDasllc
  | StepFileIoDasrfr
  | StepFileIoDaswbr
  | StepFileIoDascls
  | StepFileIoDlaopn
  | StepFileIoDlabbs
  | StepFileIoDlabns
  | StepFileIoDlaens
  | StepFileIoDlafps
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

function dasRowBytes(data: readonly number[]): Uint8Array {
  if (data.some((x) => !Number.isInteger(x) || x < 0 || x > 255))
    throw new TypeError("Expected DAS bytes in [0,255]");
  return Uint8Array.from(data);
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

    case "file-io.dasadc": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasadc(
        h,
        step.n,
        step.bpos,
        step.epos,
        step.datlen,
        dasRowBytes(step.data),
      );
      return { op: step.op, value: null };
    }
    case "file-io.dasadd": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasadd(h, step.n, step.data);
      return { op: step.op, value: null };
    }
    case "file-io.dasadi": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasadi(h, step.n, step.data);
      return { op: step.op, value: null };
    }
    case "file-io.dasrdc": {
      const h = requireHandleState(context, step.handleId).handle;
      return {
        op: step.op,
        value: Array.from(
          context.spice.raw.dasrdc(
            h,
            step.first,
            step.last,
            step.bpos,
            step.epos,
            step.datlen,
            dasRowBytes(step.data),
          ),
        ),
      };
    }
    case "file-io.dasrdd": {
      const h = requireHandleState(context, step.handleId).handle;
      return {
        op: step.op,
        value: context.spice.raw.dasrdd(h, step.first, step.last),
      };
    }
    case "file-io.dasrdi": {
      const h = requireHandleState(context, step.handleId).handle;
      return {
        op: step.op,
        value: context.spice.raw.dasrdi(h, step.first, step.last),
      };
    }
    case "file-io.dasudc": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasudc(
        h,
        step.first,
        step.last,
        step.bpos,
        step.epos,
        step.datlen,
        dasRowBytes(step.data),
      );
      return { op: step.op, value: null };
    }
    case "file-io.dasudd": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasudd(h, step.first, step.last, step.data);
      return { op: step.op, value: null };
    }
    case "file-io.dasudi": {
      const h = requireHandleState(context, step.handleId).handle;
      context.spice.raw.dasudi(h, step.first, step.last, step.data);
      return { op: step.op, value: null };
    }
    case "file-io.dasonw":
    case "file-io.dasops":
    case "file-io.dasopw": {
      if (context.state.fileIo.handles.get(step.handleId)?.isOpen)
        throw new Error("File-io handle already open: " + step.handleId);
      const raw = context.spice.raw;
      let handle: SpiceHandle;
      if (step.op === "file-io.dasops") handle = raw.dasops();
      else {
        if (toPathRef(step.path).kind !== "scratch")
          throw new Error("DAS writer workflows require a scratch path");
        const path = resolveFileIoPath(step.path);
        handle =
          step.op === "file-io.dasopw"
            ? raw.dasopw(path)
            : raw.dasonw(path, step.ftype, step.ifname, step.ncomr);
      }
      registerHandleState(context, step.handleId, handle, "dascls");
      return { op: step.op, value: null };
    }
    case "file-io.dashfn": {
      const { handle } = requireHandleState(context, step.handleId);
      const raw = context.spice.raw;
      const value = raw.dashfn(handle, step.namlen);
      const full = raw.dashfn(handle);
      // Remove the backend-generated staging root, retaining every logical
      // directory. Capacity applies to the physical path before normalization.
      const name = full.replace(/^.*?\/py-parity\//, "");
      return {
        op: step.op,
        value: {
          name,
          prefixMatches: value === full.slice(0, (step.namlen ?? 256) - 1),
        },
      };
    }
    case "file-io.dashfs":
      return {
        op: step.op,
        value: context.spice.raw.dashfs(
          requireHandleState(context, step.handleId).handle,
        ),
      };
    case "file-io.daslla":
      return {
        op: step.op,
        value: context.spice.raw.daslla(
          requireHandleState(context, step.handleId).handle,
        ),
      };
    case "file-io.dasrfr":
      return {
        op: step.op,
        value: context.spice.raw.dasrfr(
          requireHandleState(context, step.handleId).handle,
          step.idwlen,
          step.ifnlen,
        ),
      };
    case "file-io.daswbr":
      context.spice.raw.daswbr(
        requireHandleState(context, step.handleId).handle,
      );
      return { op: step.op, value: null };
    case "file-io.dasllc": {
      const state = requireHandleState(context, step.handleId);
      context.spice.raw.dasllc(state.handle);
      state.isOpen = false;
      return { op: step.op, value: null };
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

    case "file-io.dlabbs": {
      const state = requireHandleState(context, step.handleId);
      const out = context.spice.raw.dlabbs(state.handle);
      if (!out.found) {
        context.state.fileIo.descriptors.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.state.fileIo.descriptors.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true, descr: out.descr } };
    }

    case "file-io.dlafps": {
      const state = requireHandleState(context, step.handleId);
      const descr = requireDescriptor(context, step.descrId);
      const out = context.spice.raw.dlafps(state.handle, descr);
      if (!out.found) {
        context.state.fileIo.descriptors.delete(step.descrId);
        return { op: step.op, value: { found: false } };
      }

      context.state.fileIo.descriptors.set(step.descrId, out.descr);
      return { op: step.op, value: { found: true, descr: out.descr } };
    }

    case "file-io.dlabns": {
      context.spice.raw.dlabns(
        requireHandleState(context, step.handleId).handle,
      );
      return { op: step.op, value: null };
    }
    case "file-io.dlaens": {
      context.spice.raw.dlaens(
        requireHandleState(context, step.handleId).handle,
      );
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
