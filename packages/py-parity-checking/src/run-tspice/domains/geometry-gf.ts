import type {
  StepGeometryGfGfdist,
  StepGeometryGfGfrefn,
  StepGeometryGfGfrepf,
  StepGeometryGfGfrepi,
  StepGeometryGfGfsep,
  StepGeometryGfGfsstp,
  StepGeometryGfGfstep,
  StepGeometryGfGfstol,
  StepOutput,
} from "../../case-types.js";
import { getOrCreateWindow, requireWindow, type RunTspiceContext } from "../context.js";

type GeometryGfStep =
  | StepGeometryGfGfdist
  | StepGeometryGfGfrefn
  | StepGeometryGfGfrepf
  | StepGeometryGfGfrepi
  | StepGeometryGfGfsep
  | StepGeometryGfGfsstp
  | StepGeometryGfGfstep
  | StepGeometryGfGfstol;

/** Execute one `geometry-gf.*` workflow step in tspice. */
export function runGeometryGfStep(context: RunTspiceContext, step: GeometryGfStep): StepOutput {
  switch (step.op) {
    case "geometry-gf.gfsstp":
      context.spice.raw.gfsstp(step.step);
      return { op: step.op, value: null };

    case "geometry-gf.gfstep":
      return { op: step.op, value: context.spice.raw.gfstep(step.time) };

    case "geometry-gf.gfstol":
      context.spice.raw.gfstol(step.value);
      return { op: step.op, value: null };

    case "geometry-gf.gfrefn":
      return { op: step.op, value: context.spice.raw.gfrefn(step.t1, step.t2, step.s1, step.s2) };

    case "geometry-gf.gfrepi": {
      const window = requireWindow(context, step.windowId);
      context.spice.raw.gfrepi(window, step.begmss, step.endmss);
      return { op: step.op, value: null };
    }

    case "geometry-gf.gfrepf":
      context.spice.raw.gfrepf();
      return { op: step.op, value: null };

    case "geometry-gf.gfsep": {
      const cnfine = requireWindow(context, step.cnfineWindowId);
      const result = getOrCreateWindow(context, step.resultWindowId, Math.max(step.nintvls, 8));
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
      return { op: step.op, value: null };
    }

    case "geometry-gf.gfdist": {
      const cnfine = requireWindow(context, step.cnfineWindowId);
      const result = getOrCreateWindow(context, step.resultWindowId, Math.max(step.nintvls, 8));
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
      return { op: step.op, value: null };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled geometry-gf step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
