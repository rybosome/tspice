import fs from "node:fs";

import type {
  SpiceHandle,
  SpiceIntCell,
} from "@rybosome/tspice-backend-contract";

import type {
  DskDescriptorPayload,
  DskType2BookkeepingPayload,
  PathRefLike,
  StepDskDascls,
  StepDskDasopr,
  StepDskDlabfs,
  StepDskDskb02,
  StepDskDskd02,
  StepDskDski02,
  StepDskDskx02,
  StepDskDskxsi,
  StepDskDskxv,
  StepDskDskgtl,
  StepDskDskstl,
  StepDskDskn02,
  StepDskDskp02,
  StepDskDskv02,
  StepDskDskz02,
  StepDskDskcls,
  StepDskDlafns,
  StepDskDskgd,
  StepDskDskmi2,
  StepDskDskobj,
  StepDskDskopn,
  StepDskDsksrf,
  StepDskDskw02,
  StepOutput,
} from "../../case-types.js";
import {
  resolvePathRef,
  toPathRef,
  toVirtualKernelPath,
} from "../../fixtures.js";
import { registerFinalizer, type RunTspiceContext } from "../context.js";

type DskStep =
  | StepDskDskobj
  | StepDskDsksrf
  | StepDskDskopn
  | StepDskDskmi2
  | StepDskDskw02
  | StepDskDasopr
  | StepDskDascls
  | StepDskDlabfs
  | StepDskDskd02
  | StepDskDski02
  | StepDskDskx02
  | StepDskDskxsi
  | StepDskDskxv
  | StepDskDskgtl
  | StepDskDskstl
  | StepDskDskn02
  | StepDskDskp02
  | StepDskDskv02
  | StepDskDskz02
  | StepDskDskcls
  | StepDskDlafns
  | StepDskDskgd
  | StepDskDskb02;

function ensureDskCleanupFinalizer(context: RunTspiceContext): void {
  if (context.state.dsk.cleanupRegistered) {
    return;
  }

  registerFinalizer(context, "dsk.close-open-handles", () => {
    for (const tracked of context.state.dsk.handles.values()) {
      if (!tracked.isOpen) {
        continue;
      }

      try {
        context.spice.raw.dascls(tracked.handle);
      } catch {
        // best-effort cleanup only
      }
    }
  });

  context.state.dsk.cleanupRegistered = true;
}

function resolveDskPathRef(
  context: RunTspiceContext,
  pathRefLike: PathRefLike,
): string {
  const pathRef = toPathRef(pathRefLike);
  const key = `${pathRef.kind}:${pathRef.rel}`;
  const cached = context.state.dsk.resolvedPathRefs.get(key);
  if (cached != null) {
    return cached;
  }

  if (pathRef.kind === "fixture") {
    const fixturePath = resolvePathRef(context.paths, pathRef);
    const virtualPath = toVirtualKernelPath(pathRef);
    const bytes = fs.readFileSync(fixturePath);
    context.spice.raw.furnsh({
      path: virtualPath,
      bytes,
    });

    context.state.kernels.loadedVirtualKernelPaths.push(virtualPath);
    context.state.dsk.resolvedPathRefs.set(key, virtualPath);
    return virtualPath;
  }

  const scratchPath = toVirtualKernelPath(pathRef, context.paths);
  context.state.dsk.resolvedPathRefs.set(key, scratchPath);
  return scratchPath;
}

function flattenVec3Rows(
  rows: readonly (readonly [number, number, number])[],
): number[] {
  const out: number[] = [];
  for (const row of rows) {
    out.push(row[0], row[1], row[2]);
  }
  return out;
}

function flattenIndexTriples(
  rows: readonly (readonly [number, number, number])[],
): number[] {
  const out: number[] = [];
  for (const row of rows) {
    out.push(row[0], row[1], row[2]);
  }
  return out;
}

function readIntCell(context: RunTspiceContext, cell: SpiceIntCell): number[] {
  const count = context.spice.raw.card(cell);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(context.spice.kit.cellGeti(cell, i));
  }
  return out;
}

function setTrackedHandle(
  context: RunTspiceContext,
  handleId: string,
  handle: SpiceHandle,
): void {
  context.state.dsk.handles.set(handleId, { handle, isOpen: true });
}

function requireTrackedHandle(
  context: RunTspiceContext,
  handleId: string,
): { handle: SpiceHandle; isOpen: boolean } {
  const tracked = context.state.dsk.handles.get(handleId);
  if (tracked == null) {
    throw new Error(`DSK handle does not exist: ${handleId}`);
  }
  return tracked;
}

function requireDlaDescriptor(context: RunTspiceContext, dladscId: string) {
  const dladsc = context.state.dsk.dlaDescriptors.get(dladscId);
  if (dladsc == null) {
    throw new Error(`DLA descriptor does not exist: ${dladscId}`);
  }
  return dladsc;
}

function requireSpatialIndex(
  context: RunTspiceContext,
  spatialIndexId: string,
) {
  const spatialIndex = context.state.dsk.spatialIndexes.get(spatialIndexId);
  if (spatialIndex == null) {
    throw new Error(`DSK spatial index does not exist: ${spatialIndexId}`);
  }
  return spatialIndex;
}

function toDskDescriptorPayload(value: {
  surfce: number;
  center: number;
  dclass: number;
  dtype: number;
  frmcde: number;
  corsys: number;
  corpar: readonly number[];
  co1min: number;
  co1max: number;
  co2min: number;
  co2max: number;
  co3min: number;
  co3max: number;
  start: number;
  stop: number;
}): DskDescriptorPayload {
  return {
    surfce: value.surfce,
    center: value.center,
    dclass: value.dclass,
    dtype: value.dtype,
    frmcde: value.frmcde,
    corsys: value.corsys,
    corpar: [...value.corpar],
    co1min: value.co1min,
    co1max: value.co1max,
    co2min: value.co2min,
    co2max: value.co2max,
    co3min: value.co3min,
    co3max: value.co3max,
    start: value.start,
    stop: value.stop,
  };
}

function toDskType2BookkeepingPayload(value: {
  nv: number;
  np: number;
  nvxtot: number;
  vtxbds: [[number, number], [number, number], [number, number]];
  voxsiz: number;
  voxori: readonly [number, number, number];
  vgrext: readonly [number, number, number];
  cgscal: number;
  vtxnpl: number;
  voxnpt: number;
  voxnpl: number;
}): DskType2BookkeepingPayload {
  return {
    nv: value.nv,
    np: value.np,
    nvxtot: value.nvxtot,
    vtxbds: [
      [value.vtxbds[0][0], value.vtxbds[0][1]],
      [value.vtxbds[1][0], value.vtxbds[1][1]],
      [value.vtxbds[2][0], value.vtxbds[2][1]],
    ],
    voxsiz: value.voxsiz,
    voxori: [value.voxori[0], value.voxori[1], value.voxori[2]],
    vgrext: [value.vgrext[0], value.vgrext[1], value.vgrext[2]],
    cgscal: value.cgscal,
    vtxnpl: value.vtxnpl,
    voxnpt: value.voxnpt,
    voxnpl: value.voxnpl,
  };
}

function queryRepetitions(step: StepDskDskobj | StepDskDsksrf): number {
  const count = step.repetitions ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 10)
    throw new RangeError(
      "DSK fixture repetitions must be an integer in [1,10]",
    );
  return count;
}

/** Execute one `dsk.*` workflow step in tspice. */
export function runDskStep(
  context: RunTspiceContext,
  step: DskStep,
): StepOutput {
  ensureDskCleanupFinalizer(context);

  switch (step.op) {
    case "dsk.dskobj": {
      const cell = context.spice.kit.newIntCell(step.cellSize ?? 10_000);
      try {
        for (const id of step.initial ?? []) context.spice.raw.insrti(id, cell);
        const snapshots: number[][] = [];
        for (let i = 0; i < queryRepetitions(step); i++) {
          context.spice.raw.dskobj(resolveDskPathRef(context, step.path), cell);
          snapshots.push(readIntCell(context, cell));
        }
        return {
          op: step.op,
          value: { bodyIds: readIntCell(context, cell), snapshots },
        };
      } finally {
        context.spice.kit.freeCell(cell);
      }
    }

    case "dsk.dsksrf": {
      const cell = context.spice.kit.newIntCell(step.cellSize ?? 10_000);
      try {
        for (const id of step.initial ?? []) context.spice.raw.insrti(id, cell);
        const snapshots: number[][] = [];
        for (let i = 0; i < queryRepetitions(step); i++) {
          context.spice.raw.dsksrf(
            resolveDskPathRef(context, step.path),
            step.bodyid,
            cell,
          );
          snapshots.push(readIntCell(context, cell));
        }
        return {
          op: step.op,
          value: { surfaceIds: readIntCell(context, cell), snapshots },
        };
      } finally {
        context.spice.kit.freeCell(cell);
      }
    }

    case "dsk.dskopn": {
      if (toPathRef(step.path).kind !== "scratch")
        throw new Error("DSK writer workflows require a scratch path");
      const handle = context.spice.raw.dskopn(
        resolveDskPathRef(context, step.path),
        step.ifname,
        step.ncomch,
      );
      setTrackedHandle(context, step.handleId, handle);
      return { op: step.op, value: null };
    }

    case "dsk.dskmi2": {
      const nv = step.vrtces.length;
      const np = step.plates.length;
      const vrtces = flattenVec3Rows(step.vrtces);
      const plates = flattenIndexTriples(step.plates);

      const { spaixd, spaixi } = context.spice.raw.dskmi2(
        nv,
        vrtces,
        np,
        plates,
        step.finscl,
        step.corscl,
        step.worksz,
        step.voxpsz,
        step.voxlsz,
        step.makvtl,
        step.spxisz,
      );

      context.state.dsk.spatialIndexes.set(step.spatialIndexId, {
        spaixd: [...spaixd],
        spaixi: [...spaixi],
      });
      return { op: step.op, value: null };
    }

    case "dsk.dskw02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const spatialIndex = requireSpatialIndex(context, step.spatialIndexId);

      const nv = step.vrtces.length;
      const np = step.plates.length;
      const vrtces = flattenVec3Rows(step.vrtces);
      const plates = flattenIndexTriples(step.plates);

      context.spice.raw.dskw02(
        tracked.handle,
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
        nv,
        vrtces,
        np,
        plates,
        spatialIndex.spaixd,
        spatialIndex.spaixi,
      );

      context.state.dsk.loadedSegments += 1;
      return { op: step.op, value: null };
    }

    case "dsk.dasopr": {
      const handle = context.spice.raw.dasopr(
        resolveDskPathRef(context, step.path),
      );
      setTrackedHandle(context, step.handleId, handle);
      return { op: step.op, value: null };
    }

    case "dsk.dascls": {
      const tracked = requireTrackedHandle(context, step.handleId);
      context.spice.raw.dascls(tracked.handle);
      context.state.dsk.handles.set(step.handleId, {
        handle: tracked.handle,
        isOpen: false,
      });
      return { op: step.op, value: null };
    }

    case "dsk.dlabfs": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const out = context.spice.raw.dlabfs(tracked.handle);
      if (!out.found) {
        context.state.dsk.dlaDescriptors.delete(step.dladscId);
        return { op: step.op, value: { found: false } };
      }

      context.state.dsk.dlaDescriptors.set(step.dladscId, out.descr);
      return { op: step.op, value: { found: true } };
    }

    case "dsk.dskd02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dskd02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
        step.item,
        step.start,
        step.room,
      );
      return { op: step.op, value };
    }
    case "dsk.dski02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dski02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
        step.item,
        step.start,
        step.room,
      );
      return { op: step.op, value };
    }
    case "dsk.dskgtl":
      return { op: step.op, value: context.spice.raw.dskgtl(step.key) };
    case "dsk.dskstl": {
      const raw = context.spice.raw;
      if (
        step.key >= 1 &&
        step.key <= 4 &&
        !context.state.dsk.savedTolerances.has(step.key)
      ) {
        const saved = raw.dskgtl(step.key);
        context.state.dsk.savedTolerances.set(step.key, saved);
        registerFinalizer(context, "restore DSK tolerance", () =>
          raw.dskstl(step.key, saved),
        );
      }
      raw.dskstl(step.key, step.value);
      return { op: step.op, value: null };
    }
    case "dsk.dskx02": {
      const handle = requireTrackedHandle(context, step.handleId).handle;
      return {
        op: step.op,
        value: context.spice.raw.dskx02(
          handle,
          requireDlaDescriptor(context, step.dladscId),
          step.vertex,
          step.raydir,
        ),
      };
    }
    case "dsk.dskxv":
      return {
        op: step.op,
        value: context.spice.raw.dskxv(
          step.pri,
          step.target,
          step.srflst,
          step.et,
          step.fixref,
          step.vertices,
          step.dirs,
        ),
      };
    case "dsk.dskxsi": {
      const raw = context.spice.raw,
        out = raw.dskxsi(
          step.pri,
          step.target,
          step.srflst,
          step.et,
          step.fixref,
          step.vertex,
          step.raydir,
          step.maxd,
          step.maxi,
        );
      if (!out.found) return { op: step.op, value: { found: false } };
      for (let i = 0; i < raw.ktotal("DSK"); i++) {
        const entry = raw.kdata(i, "DSK");
        if (entry.found && entry.handle === out.handle) {
          const sourceFile = entry.file
            .replaceAll("\\", "/")
            .split("/")
            .at(-1)!;
          return {
            op: step.op,
            value: {
              found: true,
              xpt: out.xpt,
              sourceFile,
              dladsc: out.dladsc,
              dskdsc: out.dskdsc,
              dc: out.dc,
              ic: out.ic,
            },
          };
        }
      }
      throw new Error("DSK source handle is absent from KEEPER");
    }
    case "dsk.dskn02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dskn02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
        step.plid,
      );
      return { op: step.op, value };
    }
    case "dsk.dskp02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dskp02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
        step.start,
        step.room,
      );
      return { op: step.op, value };
    }
    case "dsk.dskv02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dskv02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
        step.start,
        step.room,
      );
      return { op: step.op, value };
    }
    case "dsk.dskz02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dskz02(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
      );
      return { op: step.op, value };
    }
    case "dsk.dskcls": {
      const tracked = requireTrackedHandle(context, step.handleId);
      context.spice.raw.dskcls(tracked.handle, step.optmiz);
      context.state.dsk.handles.set(step.handleId, {
        handle: tracked.handle,
        isOpen: false,
      });
      return { op: step.op, value: null };
    }
    case "dsk.dlafns": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const value = context.spice.raw.dlafns(
        tracked.handle,
        requireDlaDescriptor(context, step.dladscId),
      );
      if (value.found)
        context.state.dsk.dlaDescriptors.set(step.nextId, value.descr);
      else context.state.dsk.dlaDescriptors.delete(step.nextId);
      return { op: step.op, value: { found: value.found } };
    }
    case "dsk.dskgd": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const dladsc = requireDlaDescriptor(context, step.dladscId);
      const out = context.spice.raw.dskgd(tracked.handle, dladsc);
      return {
        op: step.op,
        value: toDskDescriptorPayload(out),
      };
    }

    case "dsk.dskb02": {
      const tracked = requireTrackedHandle(context, step.handleId);
      const dladsc = requireDlaDescriptor(context, step.dladscId);
      const out = context.spice.raw.dskb02(tracked.handle, dladsc);
      return {
        op: step.op,
        value: toDskType2BookkeepingPayload(out),
      };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled dsk step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
