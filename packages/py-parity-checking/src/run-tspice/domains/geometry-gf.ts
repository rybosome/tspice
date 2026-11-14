import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type {
  StepGeometryGfGfdist,
  StepGeometryGfGfrefn,
  StepGeometryGfGfbail,
  StepGeometryGfGfclrh,
  StepGeometryGfGfinth,
  StepGeometryGfGfrepu,
  StepGeometryGfGfrepf,
  StepGeometryGfGfrepi,
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
  | StepGeometryGfGfbail
  | StepGeometryGfGfclrh
  | StepGeometryGfGfinth
  | StepGeometryGfGfrepu
  | StepGeometryGfGfrepf
  | StepGeometryGfGfrepi
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

function preserveInterruptFlag(context: RunTspiceContext): void {
  const label = "geometryGF.restoreInterrupt";
  if (context.lifecycle.finalizers.some((entry) => entry.label === label))
    return;
  const before = context.spice.raw.gfbail();
  registerFinalizer(context, label, () => {
    if (before) context.spice.raw.gfinth(2);
    else context.spice.raw.gfclrh();
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
      if (
        !context.lifecycle.finalizers.some(
          (x) => x.label === "geometryGF.endReport",
        )
      )
        registerFinalizer(context, "geometryGF.endReport", () =>
          context.spice.raw.gfrepf(),
        );
      return { op: step.op, value: null };
    }

    case "geometry-gf.gfbail":
      return { op: step.op, value: context.spice.raw.gfbail() };
    case "geometry-gf.gfclrh":
      preserveInterruptFlag(context);
      context.spice.raw.gfclrh();
      return { op: step.op, value: null };
    case "geometry-gf.gfinth":
      preserveInterruptFlag(context);
      context.spice.raw.gfinth(step.sigcode);
      return { op: step.op, value: null };
    case "geometry-gf.gfrepu":
      context.spice.raw.gfrepu(step.ivbeg, step.ivend, step.time);
      return { op: step.op, value: null };
    case "geometry-gf.gfrepf":
      context.spice.raw.gfrepf();
      context.lifecycle.finalizers = context.lifecycle.finalizers.filter(
        (x) => x.label !== "geometryGF.endReport",
      );
      return { op: step.op, value: null };

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
