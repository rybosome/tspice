import type {
  StepCoordsVectorsAxisar,
  StepCoordsVectorsGeorec,
  StepCoordsVectorsLatrec,
  StepCoordsVectorsMtxv,
  StepCoordsVectorsMxm,
  StepCoordsVectorsMxv,
  StepCoordsVectorsVdist,
  StepCoordsVectorsVequ,
  StepCoordsVectorsVpack,
  StepCoordsVectorsVupack,
  StepCoordsVectorsVzero,
  StepCoordsVectorsUnorm,
  StepCoordsVectorsUcrss,
  StepCoordsVectorsVsep,
  StepCoordsVectorsReclat,
  StepCoordsVectorsRecgeo,
  StepCoordsVectorsRecsph,
  StepCoordsVectorsRotate,
  StepCoordsVectorsRotmat,
  StepCoordsVectorsSphrec,
  StepCoordsVectorsVadd,
  StepCoordsVectorsVcrss,
  StepCoordsVectorsVdot,
  StepCoordsVectorsVhat,
  StepCoordsVectorsVminus,
  StepCoordsVectorsVnorm,
  StepCoordsVectorsVscl,
  StepCoordsVectorsVsub,
  StepOutput,
  Vector3,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";
import { flattenMatrix, unflattenMatrix } from "../utils/matrix.js";

type CoordsVectorsStep =
  | StepCoordsVectorsVdist
  | StepCoordsVectorsVequ
  | StepCoordsVectorsVpack
  | StepCoordsVectorsVupack
  | StepCoordsVectorsVzero
  | StepCoordsVectorsUnorm
  | StepCoordsVectorsUcrss
  | StepCoordsVectorsVsep
  | StepCoordsVectorsReclat
  | StepCoordsVectorsLatrec
  | StepCoordsVectorsRecsph
  | StepCoordsVectorsSphrec
  | StepCoordsVectorsVnorm
  | StepCoordsVectorsVhat
  | StepCoordsVectorsVdot
  | StepCoordsVectorsVcrss
  | StepCoordsVectorsVadd
  | StepCoordsVectorsVsub
  | StepCoordsVectorsVminus
  | StepCoordsVectorsVscl
  | StepCoordsVectorsMxm
  | StepCoordsVectorsRotate
  | StepCoordsVectorsRotmat
  | StepCoordsVectorsAxisar
  | StepCoordsVectorsGeorec
  | StepCoordsVectorsRecgeo
  | StepCoordsVectorsMxv
  | StepCoordsVectorsMtxv;

function toVector3(values: readonly number[]): Vector3 {
  if (values.length !== 3) {
    throw new Error(`Expected vector length 3, got ${values.length}`);
  }

  const x = values[0];
  const y = values[1];
  const z = values[2];

  if (x === undefined || y === undefined || z === undefined) {
    throw new Error(
      `Expected vector length 3 with defined entries, got ${JSON.stringify(values)}`,
    );
  }

  return [x, y, z];
}

/** Execute one `coords-vectors.*` workflow step in tspice. */
export function runCoordsVectorsStep(
  context: RunTspiceContext,
  step: CoordsVectorsStep,
): StepOutput {
  switch (step.op) {
    case "coords-vectors.vdist": {
      const out = context.spice.raw.vdist(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vequ": {
      const out = context.spice.raw.vequ(step.v);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vpack": {
      const out = context.spice.raw.vpack(step.x, step.y, step.z);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vupack": {
      const out = context.spice.raw.vupack(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vzero": {
      const out = context.spice.raw.vzero(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.unorm": {
      const out = context.spice.raw.unorm(step.v);
      return {
        op: step.op,
        value: { unit: toVector3(out.unit), norm: out.norm },
      };
    }

    case "coords-vectors.ucrss": {
      const out = context.spice.raw.ucrss(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vsep": {
      const out = context.spice.raw.vsep(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.reclat": {
      const out = context.spice.raw.reclat(step.rectan);
      return { op: step.op, value: out };
    }

    case "coords-vectors.latrec": {
      const out = context.spice.raw.latrec(step.radius, step.lon, step.lat);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.recsph": {
      const out = context.spice.raw.recsph(step.rectan);
      return { op: step.op, value: out };
    }

    case "coords-vectors.sphrec": {
      const out = context.spice.raw.sphrec(step.radius, step.colat, step.lon);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vnorm":
      return { op: step.op, value: context.spice.raw.vnorm(step.v) };

    case "coords-vectors.vhat": {
      const out = context.spice.raw.vhat(step.v);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vdot":
      return { op: step.op, value: context.spice.raw.vdot(step.a, step.b) };

    case "coords-vectors.vcrss": {
      const out = context.spice.raw.vcrss(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vadd": {
      const out = context.spice.raw.vadd(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vsub": {
      const out = context.spice.raw.vsub(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vminus": {
      const out = context.spice.raw.vminus(step.v);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vscl": {
      const out = context.spice.raw.vscl(step.s, step.v);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.mxm": {
      const out = context.spice.raw.mxm(
        flattenMatrix(step.m1),
        flattenMatrix(step.m2),
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.rotate": {
      const out = context.spice.raw.rotate(step.angle, step.axis);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.rotmat": {
      const out = context.spice.raw.rotmat(
        flattenMatrix(step.m),
        step.angle,
        step.axis,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.axisar": {
      const out = context.spice.raw.axisar(step.axis, step.angle);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.georec": {
      const out = context.spice.raw.georec(
        step.lon,
        step.lat,
        step.alt,
        step.re,
        step.f,
      );
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.recgeo": {
      const out = context.spice.raw.recgeo(step.rectan, step.re, step.f);
      return { op: step.op, value: out };
    }

    case "coords-vectors.mxv": {
      const out = context.spice.raw.mxv(flattenMatrix(step.m), step.v);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.mtxv": {
      const out = context.spice.raw.mtxv(flattenMatrix(step.m), step.v);
      return { op: step.op, value: toVector3(out) };
    }

    default: {
      const exhaustive: never = step;
      throw new Error(
        `Unhandled coords-vectors step: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
