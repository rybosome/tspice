import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import type {
  StepGeometryGfUdf,
  StepGeometryGfUddc,
  StepGeometryGfUddf,
  StepGeometryGfGfudb,
  StepGeometryGfGfuds,
  GfCallbackTrace,
  StepGeometryGfGfdist,
  StepGeometryGfGfrefn,
  StepGeometryGfGfrepf,
  StepGeometryGfGfrepi,
  StepGeometryGfGfoclt,
  StepGeometryGfGfrfov,
  StepGeometryGfGftfov,
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
  | StepGeometryGfUdf
  | StepGeometryGfUddc
  | StepGeometryGfUddf
  | StepGeometryGfGfudb
  | StepGeometryGfGfuds
  | StepGeometryGfGfdist
  | StepGeometryGfGfrefn
  | StepGeometryGfGfrepf
  | StepGeometryGfGfrepi
  | StepGeometryGfGfoclt
  | StepGeometryGfGfrfov
  | StepGeometryGfGftfov
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

/** The workflow selects a pure, reproducible measurement. The toolkit chooses every sample epoch. */
function userMeasurement(name: string, trace: GfCallbackTrace) {
  const functions: Record<string, (x: number) => number> = {
    constant: () => 7,
    identity: (x) => x,
    negativeAffine: (x) => 4 - 2 * x,
    square: (x) => x * x,
    negativeSquare: (x) => -(x * x),
    cubic: (x) => x * x * x - 3 * x,
  };
  const measure = Object.hasOwn(functions, name) ? functions[name] : undefined;
  if (!measure) throw new TypeError("Unknown user measurement: " + name);
  return (x: number) => {
    const value = measure(x);
    trace.scalarSamples.push([x, value]);
    return value;
  };
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

    case "geometry-gf.udf":
      return {
        op: step.op,
        value:
          step.initialValue === undefined
            ? context.spice.raw.udf(step.et)
            : context.spice.raw.udf(step.et, step.initialValue),
      };
    case "geometry-gf.uddc":
    case "geometry-gf.uddf": {
      const trace: GfCallbackTrace = {
        scalarSamples: [],
        conditionSamples: [],
      };
      const f = userMeasurement(step.scalar, trace);
      if (step.op === "geometry-gf.uddc")
        return {
          op: step.op,
          value: {
            decreasing: context.spice.raw.uddc(f, step.x, step.dx),
            scalarSamples: trace.scalarSamples,
          },
        };
      return {
        op: step.op,
        value: {
          derivative: context.spice.raw.uddf(f, step.x, step.dx),
          scalarSamples: trace.scalarSamples,
        },
      };
    }
    case "geometry-gf.gfudb":
    case "geometry-gf.gfuds": {
      preserveSearchStep(context);
      const trace: GfCallbackTrace = {
        scalarSamples: [],
        conditionSamples: [],
      };
      const scalar = userMeasurement(step.scalar, trace);
      const cnfine = requireWindow(context, step.cnfineWindowId);
      const result = getOrCreateWindow(
        context,
        step.resultWindowId,
        step.resultMaxIntervals ?? 8,
      );
      if (step.op === "geometry-gf.gfudb") {
        const condition = (f: (x: number) => number, t: number) => {
          let value: boolean;
          switch (step.predicate) {
            case "above":
              value = f(t) > step.threshold;
              break;
            case "below":
              value = f(t) < step.threshold;
              break;
            case "always":
              value = true;
              break;
            case "never":
              value = false;
              break;
            default:
              throw new TypeError("Unknown GF predicate: " + step.predicate);
          }
          trace.conditionSamples.push([t, value]);
          return value;
        };
        context.spice.raw.gfudb(scalar, condition, step.step, cnfine, result);
      } else {
        const decreasing = (f: (x: number) => number, t: number) => {
          const before = f(t - step.conditionDx),
            after = f(t + step.conditionDx);
          const value = after < before;
          trace.conditionSamples.push([t, value]);
          return value;
        };
        context.spice.raw.gfuds(
          scalar,
          decreasing,
          step.relate,
          step.refval,
          step.adjust,
          step.step,
          step.nintvls,
          cnfine,
          result,
        );
      }
      return {
        op: step.op,
        value: {
          ...trace,
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
