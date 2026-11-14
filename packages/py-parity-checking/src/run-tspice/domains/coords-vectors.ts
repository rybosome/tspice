import type {
  StepCoordsVectorsAxisar,
  StepCoordsVectorsGeorec,
  StepCoordsVectorsLatrec,
  StepCoordsVectorsMtxv,
  StepCoordsVectorsMxm,
  StepCoordsVectorsMxv,
  StepCoordsVectorsVaddg,
  StepCoordsVectorsVdistg,
  StepCoordsVectorsVdotg,
  StepCoordsVectorsVequg,
  StepCoordsVectorsVhatg,
  StepCoordsVectorsVlcomg,
  StepCoordsVectorsVminug,
  StepCoordsVectorsVnormg,
  StepCoordsVectorsVprojg,
  StepCoordsVectorsVrelg,
  StepCoordsVectorsVsclg,
  StepCoordsVectorsVsepg,
  StepCoordsVectorsVsubg,
  StepCoordsVectorsVzerog,
  StepCoordsVectorsUnormg,
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
  | StepCoordsVectorsVaddg
  | StepCoordsVectorsVdistg
  | StepCoordsVectorsVdotg
  | StepCoordsVectorsVequg
  | StepCoordsVectorsVhatg
  | StepCoordsVectorsVlcomg
  | StepCoordsVectorsVminug
  | StepCoordsVectorsVnormg
  | StepCoordsVectorsVprojg
  | StepCoordsVectorsVrelg
  | StepCoordsVectorsVsclg
  | StepCoordsVectorsVsepg
  | StepCoordsVectorsVsubg
  | StepCoordsVectorsVzerog
  | StepCoordsVectorsUnormg
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
    case "coords-vectors.vaddg": {
      const out = context.spice.raw.vaddg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vdistg": {
      const out = context.spice.raw.vdistg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vdotg": {
      const out = context.spice.raw.vdotg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vequg": {
      const out = context.spice.raw.vequg(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vhatg": {
      const out = context.spice.raw.vhatg(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vlcomg": {
      const out = context.spice.raw.vlcomg(step.a, step.v1, step.b, step.v2);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vminug": {
      const out = context.spice.raw.vminug(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vnormg": {
      const out = context.spice.raw.vnormg(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vprojg": {
      const out = context.spice.raw.vprojg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vrelg": {
      const out = context.spice.raw.vrelg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vsclg": {
      const out = context.spice.raw.vsclg(step.s, step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vsepg": {
      const out = context.spice.raw.vsepg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vsubg": {
      const out = context.spice.raw.vsubg(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vzerog": {
      const out = context.spice.raw.vzerog(step.v);
      return { op: step.op, value: out };
    }

    case "coords-vectors.unormg": {
      const out = context.spice.raw.unormg(step.v);
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
