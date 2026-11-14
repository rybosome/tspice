import type {
  SpicePlane,
  StepGeometryIlumin,
  StepGeometryIllumf,
  StepGeometryIllumg,
  StepGeometryNvp2pl,
  StepGeometryPl2nvp,
  StepGeometryPl2psv,
  StepGeometryPsv2pl,
  StepGeometryInrypl,
  StepGeometryVprjp,
  StepGeometryVprjpi,
  StepGeometryNplnpt,
  StepGeometryCgv2el,
  StepGeometryEl2cgv,
  StepGeometrySaelgv,
  StepGeometryPjelpl,
  StepGeometryInelpl,
  StepGeometryInedpl,
  StepGeometryNpelpt,
  StepGeometryNvc2pl,
  StepGeometryOccult,
  StepGeometryPl2nvc,
  StepGeometrySincpt,
  StepGeometrySubpnt,
  StepGeometrySubslr,
  StepOutput,
  Vec3,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";

type GeometryStep =
  | StepGeometrySubpnt
  | StepGeometrySubslr
  | StepGeometrySincpt
  | StepGeometryIlumin
  | StepGeometryIllumg
  | StepGeometryIllumf
  | StepGeometryOccult
  | StepGeometryNvp2pl
  | StepGeometryPl2nvp
  | StepGeometryPl2psv
  | StepGeometryPsv2pl
  | StepGeometryInrypl
  | StepGeometryVprjp
  | StepGeometryVprjpi
  | StepGeometryNplnpt
  | StepGeometryCgv2el
  | StepGeometryEl2cgv
  | StepGeometrySaelgv
  | StepGeometryPjelpl
  | StepGeometryInelpl
  | StepGeometryInedpl
  | StepGeometryNpelpt
  | StepGeometryNvc2pl
  | StepGeometryPl2nvc;

function toVec3(values: readonly number[], label: string): Vec3 {
  if (values.length !== 3) {
    throw new Error(`${label} must be a length-3 vector`);
  }
  return [values[0]!, values[1]!, values[2]!];
}

function toPlane(values: readonly number[], label: string): SpicePlane {
  if (values.length !== 4) {
    throw new Error(`${label} must be a length-4 plane`);
  }
  return [values[0]!, values[1]!, values[2]!, values[3]!];
}

/** Execute one `geometry.*` workflow step in tspice. */
export function runGeometryStep(
  context: RunTspiceContext,
  step: GeometryStep,
): StepOutput {
  switch (step.op) {
    case "geometry.subpnt": {
      const out = context.spice.raw.subpnt(
        step.method,
        step.target,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
      );
      return {
        op: step.op,
        value: {
          spoint: toVec3(out.spoint, "geometry.subpnt.spoint"),
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.subpnt.srfvec"),
        },
      };
    }

    case "geometry.subslr": {
      const out = context.spice.raw.subslr(
        step.method,
        step.target,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
      );
      return {
        op: step.op,
        value: {
          spoint: toVec3(out.spoint, "geometry.subslr.spoint"),
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.subslr.srfvec"),
        },
      };
    }

    case "geometry.sincpt": {
      const out = context.spice.raw.sincpt(
        step.method,
        step.target,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
        step.dref,
        step.dvec,
      );
      if (!out.found) {
        return { op: step.op, value: { found: false } };
      }
      return {
        op: step.op,
        value: {
          found: true,
          spoint: toVec3(out.spoint, "geometry.sincpt.spoint"),
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.sincpt.srfvec"),
        },
      };
    }

    case "geometry.ilumin": {
      const out = context.spice.raw.ilumin(
        step.method,
        step.target,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
        step.spoint,
      );
      return {
        op: step.op,
        value: {
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.ilumin.srfvec"),
          phase: out.phase,
          incdnc: out.incdnc,
          emissn: out.emissn,
        },
      };
    }

    case "geometry.illumg": {
      const out = context.spice.raw.illumg(
        step.method,
        step.target,
        step.ilusrc,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
        step.spoint,
      );
      return {
        op: step.op,
        value: {
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.illumg.srfvec"),
          phase: out.phase,
          incdnc: out.incdnc,
          emissn: out.emissn,
        },
      };
    }

    case "geometry.illumf": {
      const out = context.spice.raw.illumf(
        step.method,
        step.target,
        step.ilusrc,
        step.et,
        step.fixref,
        step.abcorr,
        step.observer,
        step.spoint,
      );
      return {
        op: step.op,
        value: {
          trgepc: out.trgepc,
          srfvec: toVec3(out.srfvec, "geometry.illumf.srfvec"),
          phase: out.phase,
          incdnc: out.incdnc,
          emissn: out.emissn,
          visibl: out.visibl,
          lit: out.lit,
        },
      };
    }

    case "geometry.occult": {
      const out = context.spice.raw.occult(
        step.targ1,
        step.shape1,
        step.frame1,
        step.targ2,
        step.shape2,
        step.frame2,
        step.abcorr,
        step.observer,
        step.et,
      );
      return { op: step.op, value: out };
    }

    case "geometry.nvp2pl":
      return {
        op: step.op,
        value: context.spice.raw.nvp2pl(step.normal, step.point),
      };
    case "geometry.pl2nvp":
      return { op: step.op, value: context.spice.raw.pl2nvp(step.plane) };
    case "geometry.pl2psv":
      return { op: step.op, value: context.spice.raw.pl2psv(step.plane) };
    case "geometry.psv2pl":
      return {
        op: step.op,
        value: context.spice.raw.psv2pl(step.point, step.span1, step.span2),
      };
    case "geometry.inrypl":
      return {
        op: step.op,
        value: context.spice.raw.inrypl(step.vertex, step.dir, step.plane),
      };
    case "geometry.vprjp":
      return {
        op: step.op,
        value: context.spice.raw.vprjp(step.vin, step.plane),
      };
    case "geometry.vprjpi":
      return {
        op: step.op,
        value: context.spice.raw.vprjpi(step.vin, step.projpl, step.invpl),
      };
    case "geometry.nplnpt":
      return {
        op: step.op,
        value: context.spice.raw.nplnpt(step.linpt, step.lindir, step.point),
      };
    case "geometry.cgv2el":
      return {
        op: step.op,
        value: context.spice.raw.cgv2el(step.center, step.vec1, step.vec2),
      };
    case "geometry.el2cgv":
      return { op: step.op, value: context.spice.raw.el2cgv(step.ellipse) };
    case "geometry.saelgv":
      return {
        op: step.op,
        value: context.spice.raw.saelgv(step.vec1, step.vec2),
      };
    case "geometry.pjelpl":
      return {
        op: step.op,
        value: context.spice.raw.pjelpl(step.ellipse, step.plane),
      };
    case "geometry.inelpl":
      return {
        op: step.op,
        value: context.spice.raw.inelpl(step.ellipse, step.plane),
      };
    case "geometry.inedpl":
      return {
        op: step.op,
        value: context.spice.raw.inedpl(step.a, step.b, step.c, step.plane),
      };
    case "geometry.npelpt":
      return {
        op: step.op,
        value: context.spice.raw.npelpt(step.point, step.ellipse),
      };
    case "geometry.nvc2pl": {
      const out = context.spice.raw.nvc2pl(step.normal, step.konst);
      return { op: step.op, value: toPlane(out, "geometry.nvc2pl") };
    }

    case "geometry.pl2nvc": {
      const out = context.spice.raw.pl2nvc(step.plane);
      return {
        op: step.op,
        value: {
          normal: toVec3(out.normal, "geometry.pl2nvc.normal"),
          konst: out.konst,
        },
      };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Unhandled geometry step: ${JSON.stringify(exhaustive)}`);
    }
  }
}
