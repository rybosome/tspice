import fs from "node:fs";
import path from "node:path";

import type {
  SpkPackedDescriptor,
  StepEphemerisSpkcls,
  StepEphemerisSpkcov,
  StepEphemerisSpkez,
  StepEphemerisSpkezp,
  StepEphemerisSpkezr,
  StepEphemerisSpkgeo,
  StepEphemerisSpkgps,
  StepEphemerisSpkobj,
  StepEphemerisSpkopa,
  StepEphemerisSpkopn,
  StepEphemerisSpkpds,
  StepEphemerisSpkpos,
  StepEphemerisSpksfs,
  StepEphemerisSpkssb,
  StepEphemerisSpkuds,
  StepEphemerisSpkw08,
  StepOutput,
} from "../../case-types.js";
import { resolvePathRef, toPathRef, toVirtualKernelPath } from "../../fixtures.js";
import {
  deleteSpkHandle,
  getOrCreateEphemerisIntCell,
  getOrCreateWindow,
  requireSpkHandle,
  setSpkHandle,
  type RunTspiceContext,
} from "../context.js";

type EphemerisStep =
  | StepEphemerisSpkcls
  | StepEphemerisSpkcov
  | StepEphemerisSpkez
  | StepEphemerisSpkezp
  | StepEphemerisSpkezr
  | StepEphemerisSpkgeo
  | StepEphemerisSpkgps
  | StepEphemerisSpkobj
  | StepEphemerisSpkopa
  | StepEphemerisSpkopn
  | StepEphemerisSpkpds
  | StepEphemerisSpkpos
  | StepEphemerisSpksfs
  | StepEphemerisSpkssb
  | StepEphemerisSpkuds
  | StepEphemerisSpkw08;

function toVec3(vec: readonly number[]): [number, number, number] {
  if (vec.length !== 3) {
    throw new Error(`Expected a length-3 vector, got length=${vec.length}`);
  }

  return [vec[0]!, vec[1]!, vec[2]!];
}

function toVec6(vec: readonly number[]): [number, number, number, number, number, number] {
  if (vec.length !== 6) {
    throw new Error(`Expected a length-6 vector, got length=${vec.length}`);
  }

  return [vec[0]!, vec[1]!, vec[2]!, vec[3]!, vec[4]!, vec[5]!];
}

function toPackedDescriptor(descr: readonly number[]): SpkPackedDescriptor {
  if (descr.length !== 5) {
    throw new Error(`Expected a length-5 packed descriptor, got length=${descr.length}`);
  }

  return [descr[0]!, descr[1]!, descr[2]!, descr[3]!, descr[4]!];
}

function resolveEphemerisPath(
  context: RunTspiceContext,
  pathRefLike:
    | StepEphemerisSpkcov["spk"]
    | StepEphemerisSpkobj["spk"]
    | StepEphemerisSpkopa["file"]
    | StepEphemerisSpkopn["file"],
  options?: { ensureParentDirectory?: boolean },
): string {
  const pathRef = toPathRef(pathRefLike);

  if (context.spice.raw.kind !== "node") {
    return toVirtualKernelPath(pathRef);
  }

  const resolved = resolvePathRef(context.paths, pathRef);
  if (options?.ensureParentDirectory && pathRef.kind === "scratch") {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  return resolved;
}

/** Execute one `ephemeris.*` workflow step in tspice. */
export function runEphemerisStep(context: RunTspiceContext, step: EphemerisStep): StepOutput {
  switch (step.op) {
    case "ephemeris.spkcls": {
      const handle = requireSpkHandle(context, step.handleId);
      context.spice.raw.spkcls(handle);
      deleteSpkHandle(context, step.handleId);
      return { op: step.op, value: null };
    }

    case "ephemeris.spkcov": {
      const cover = getOrCreateWindow(context, step.coverWindowId, step.maxIntervals ?? 16);
      context.spice.raw.spkcov(resolveEphemerisPath(context, step.spk), step.idcode, cover);
      const count = context.spice.raw.wncard(cover);
      const intervals: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const [left, right] = context.spice.raw.wnfetd(cover, i);
        intervals.push([left, right]);
      }
      return { op: step.op, value: { intervals } };
    }

    case "ephemeris.spkez": {
      const out = context.spice.raw.spkez(step.target, step.et, step.ref, step.abcorr, step.observer);
      return {
        op: step.op,
        value: {
          state: toVec6(out.state),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spkezp": {
      const out = context.spice.raw.spkezp(step.target, step.et, step.ref, step.abcorr, step.observer);
      return {
        op: step.op,
        value: {
          pos: toVec3(out.pos),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spkezr": {
      const out = context.spice.raw.spkezr(step.target, step.et, step.ref, step.abcorr, step.observer);
      return {
        op: step.op,
        value: {
          state: toVec6(out.state),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spkgeo": {
      const out = context.spice.raw.spkgeo(step.target, step.et, step.ref, step.observer);
      return {
        op: step.op,
        value: {
          state: toVec6(out.state),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spkgps": {
      const out = context.spice.raw.spkgps(step.target, step.et, step.ref, step.observer);
      return {
        op: step.op,
        value: {
          pos: toVec3(out.pos),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spkobj": {
      const ids = getOrCreateEphemerisIntCell(context, step.idsCellId, step.maxCardinality ?? 1024);
      context.spice.raw.spkobj(resolveEphemerisPath(context, step.spk), ids);
      const count = context.spice.raw.card(ids);
      const values: number[] = [];
      for (let i = 0; i < count; i++) {
        values.push(context.spice.kit.cellGeti(ids, i));
      }
      return {
        op: step.op,
        value: {
          ids: values,
        },
      };
    }

    case "ephemeris.spkopa": {
      const handle = context.spice.raw.spkopa(
        resolveEphemerisPath(context, step.file, { ensureParentDirectory: true }),
      );
      setSpkHandle(context, step.handleId, handle);
      return {
        op: step.op,
        value: {
          handleId: step.handleId,
        },
      };
    }

    case "ephemeris.spkopn": {
      const handle = context.spice.raw.spkopn(
        resolveEphemerisPath(context, step.file, { ensureParentDirectory: true }),
        step.ifname,
        step.ncomch,
      );
      setSpkHandle(context, step.handleId, handle);
      return {
        op: step.op,
        value: {
          handleId: step.handleId,
        },
      };
    }

    case "ephemeris.spkpds": {
      const out = context.spice.raw.spkpds(
        step.body,
        step.center,
        step.frame,
        step.type,
        step.first,
        step.last,
      );
      return {
        op: step.op,
        value: toPackedDescriptor(out),
      };
    }

    case "ephemeris.spkpos": {
      const out = context.spice.raw.spkpos(step.target, step.et, step.ref, step.abcorr, step.observer);
      return {
        op: step.op,
        value: {
          pos: toVec3(out.pos),
          lt: out.lt,
        },
      };
    }

    case "ephemeris.spksfs": {
      const out = context.spice.raw.spksfs(step.body, step.et);
      if (!out.found) {
        return {
          op: step.op,
          value: {
            found: false,
          },
        };
      }

      return {
        op: step.op,
        value: {
          found: true,
          descr: toPackedDescriptor(out.descr),
          ident: out.ident,
        },
      };
    }

    case "ephemeris.spkssb": {
      const out = context.spice.raw.spkssb(step.target, step.et, step.ref);
      return {
        op: step.op,
        value: toVec6(out),
      };
    }

    case "ephemeris.spkuds": {
      const out = context.spice.raw.spkuds(step.descr);
      return {
        op: step.op,
        value: {
          body: out.body,
          center: out.center,
          frame: out.frame,
          type: out.type,
          first: out.first,
          last: out.last,
          baddr: out.baddr,
          eaddr: out.eaddr,
        },
      };
    }

    case "ephemeris.spkw08": {
      const handle = requireSpkHandle(context, step.handleId);
      context.spice.raw.spkw08(
        handle,
        step.body,
        step.center,
        step.frame,
        step.first,
        step.last,
        step.segid,
        step.degree,
        step.states,
        step.epoch1,
        step.step,
      );
      return { op: step.op, value: null };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled ephemeris step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
