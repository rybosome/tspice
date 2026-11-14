import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type {
  StepGeometryGfGfdist,
  StepGeometryGfGfrefn,
  StepGeometryGfGfrepf,
  StepGeometryGfGfrepi,
  StepGeometryGfGfoclt,
  StepGeometryGfGfrfov,
  StepGeometryGfGftfov,
  StepGeometryGfGfpa,
  StepGeometryGfGfposc,
  StepGeometryGfGfrr,
  StepGeometryGfGfsntc,
  StepGeometryGfGfsubc,
  StepGeometryGfGfilum,
  StepGeometryGfGfsep,
  StepGeometryGfGfsstp,
  StepGeometryGfGfstep,
  StepGeometryGfGfstol,
  StepOutput,
} from "../../case-types.js";
import {
  getOrCreateWindow,
  registerFinalizer,
  requireWindow,
  type RunTspiceContext,
} from "../context.js";

type GeometryGfStep =
  | StepGeometryGfGfdist
  | StepGeometryGfGfrefn
  | StepGeometryGfGfrepf
  | StepGeometryGfGfrepi
  | StepGeometryGfGfoclt
  | StepGeometryGfGfrfov
  | StepGeometryGfGftfov
  | StepGeometryGfGfpa
  | StepGeometryGfGfposc
  | StepGeometryGfGfrr
  | StepGeometryGfGfsntc
  | StepGeometryGfGfsubc
  | StepGeometryGfGfilum
  | StepGeometryGfGfsep
  | StepGeometryGfGfsstp
  | StepGeometryGfGfstep
  | StepGeometryGfGfstol;

function assertBoolean(
  value: unknown,
  context: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${context}: expected boolean`);
  }
}

function windowIntervals(
  context: RunTspiceContext,
  window: SpiceWindow,
): [number, number][] {
  const intervals: [number, number][] = [];
  const count = context.spice.raw.wncard(window);
  for (let i = 0; i < count; i++) {
    const [left, right] = context.spice.raw.wnfetd(window, i);
    intervals.push([left, right]);
  }
  return intervals;
}

/** Each sidecar gets a fresh process. Restore the native runtime's existing
 * step once per workflow when N0067 has one. Its initial unset state has no setter. */
function preserveSearchStep(context: RunTspiceContext): void {
  const label = "geometryGF.restoreSearchStep";
  if (context.lifecycle.finalizers.some((item) => item.label === label)) return;
  let previous: number | undefined;
  try {
    previous = context.spice.raw.gfstep(0);
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("NOTINITIALIZED")))
      throw error;
  }
  registerFinalizer(context, label, () => {
    if (previous !== undefined) context.spice.raw.gfsstp(previous);
  });
}

/** Execute one `geometry-gf.*` workflow step in tspice. */
export function runGeometryGfStep(
  context: RunTspiceContext,
  step: GeometryGfStep,
): StepOutput {
  switch (step.op) {
    case "geometry-gf.gfsstp":
      context.spice.raw.gfsstp(step.step);
      return { op: step.op, value: null };

    case "geometry-gf.gfstep":
      return { op: step.op, value: context.spice.raw.gfstep(step.time) };

    case "geometry-gf.gfstol":
      // Each test case owns this process-global setting; restore NAIF's default
      // even if a later scientific query fails. Raw API persistence is unchanged.
      registerFinalizer(context, "geometryGF.restoreTolerance", () =>
        context.spice.raw.gfstol(1e-6),
      );
      context.spice.raw.gfstol(step.value);
      return { op: step.op, value: null };

    case "geometry-gf.gfrefn": {
      assertBoolean(step.s1, "geometry-gf.gfrefn.s1");
      assertBoolean(step.s2, "geometry-gf.gfrefn.s2");
      return {
        op: step.op,
        value: context.spice.raw.gfrefn(step.t1, step.t2, step.s1, step.s2),
      };
    }

    case "geometry-gf.gfrepi": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.gfrepi(window, step.begmss, step.endmss);
      return { op: step.op, value: null };
    }

    case "geometry-gf.gfrepf":
      context.spice.raw.gfrepf();
      return { op: step.op, value: null };

    case "geometry-gf.gfoclt": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfoclt(
        step.occtyp,
        step.front,
        step.fshape,
        step.fframe,
        step.back,
        step.bshape,
        step.bframe,
        step.abcorr,
        step.obsrvr,
        step.step,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfrfov": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfrfov(
        step.inst,
        step.raydir,
        step.rframe,
        step.abcorr,
        step.obsrvr,
        step.step,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gftfov": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gftfov(
        step.inst,
        step.target,
        step.tshape,
        step.tframe,
        step.abcorr,
        step.obsrvr,
        step.step,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfpa": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfpa(
        step.target,
        step.illmn,
        step.abcorr,
        step.obsrvr,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfposc": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfposc(
        step.target,
        step.frame,
        step.abcorr,
        step.obsrvr,
        step.crdsys,
        step.coord,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfrr": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfrr(
        step.target,
        step.abcorr,
        step.obsrvr,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfsntc": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfsntc(
        step.target,
        step.fixref,
        step.method,
        step.abcorr,
        step.obsrvr,
        step.dref,
        step.dvec,
        step.crdsys,
        step.coord,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfsubc": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfsubc(
        step.target,
        step.fixref,
        step.method,
        step.abcorr,
        step.obsrvr,
        step.crdsys,
        step.coord,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfilum": {
      preserveSearchStep(context);
      const cnfine = requireWindow(context, step.cnfineWindowId),
        result = getOrCreateWindow(
          context,
          step.resultWindowId,
          step.resultMaxIntervals ?? 8,
        );
      context.spice.raw.gfilum(
        step.method,
        step.angtyp,
        step.target,
        step.illmn,
        step.fixref,
        step.abcorr,
        step.obsrvr,
        step.spoint,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }
    case "geometry-gf.gfsep": {
      const cnfine = requireWindow(context, step.cnfineWindowId);
      const result = getOrCreateWindow(
        context,
        step.resultWindowId,
        step.resultMaxIntervals ?? Math.max(step.nintvls, 8),
      );
      context.spice.raw.gfsep(
        step.targ1,
        step.shape1,
        step.frame1,
        step.targ2,
        step.shape2,
        step.frame2,
        step.abcorr,
        step.obsrvr,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }

    case "geometry-gf.gfdist": {
      const cnfine = requireWindow(context, step.cnfineWindowId);
      const result = getOrCreateWindow(
        context,
        step.resultWindowId,
        step.resultMaxIntervals ?? Math.max(step.nintvls, 8),
      );
      context.spice.raw.gfdist(
        step.target,
        step.abcorr,
        step.obsrvr,
        step.relate,
        step.refval,
        step.adjust,
        step.step,
        step.nintvls,
        cnfine,
        result,
      );
      return {
        op: step.op,
        value: {
          intervals: windowIntervals(context, result),
          confinementIntervals: windowIntervals(context, cnfine),
        },
      };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(
        `Unhandled geometry-gf step: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
