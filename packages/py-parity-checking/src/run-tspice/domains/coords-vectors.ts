import type {
  StepCoordsVectorsAxisar,
  StepCoordsVectorsGeorec,
  StepCoordsVectorsLatrec,
  StepCoordsVectorsMtxv,
  StepCoordsVectorsMxm,
  StepCoordsVectorsMxv,
  StepCoordsVectorsLstlec,
  StepCoordsVectorsLstled,
  StepCoordsVectorsLstlei,
  StepCoordsVectorsLstltc,
  StepCoordsVectorsLstltd,
  StepCoordsVectorsLstlti,
  StepCoordsVectorsBschoc,
  StepCoordsVectorsBschoi,
  StepCoordsVectorsBsrchc,
  StepCoordsVectorsBsrchd,
  StepCoordsVectorsBsrchi,
  StepCoordsVectorsIsrchc,
  StepCoordsVectorsIsrchd,
  StepCoordsVectorsIsrchi,
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
  | StepCoordsVectorsLstlec
  | StepCoordsVectorsLstled
  | StepCoordsVectorsLstlei
  | StepCoordsVectorsLstltc
  | StepCoordsVectorsLstltd
  | StepCoordsVectorsLstlti
  | StepCoordsVectorsBschoc
  | StepCoordsVectorsBschoi
  | StepCoordsVectorsBsrchc
  | StepCoordsVectorsBsrchd
  | StepCoordsVectorsBsrchi
  | StepCoordsVectorsIsrchc
  | StepCoordsVectorsIsrchd
  | StepCoordsVectorsIsrchi
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
    case "coords-vectors.bschoc": {
      const out = context.spice.raw.bschoc(step.key, step.values, step.order);
      return { op: step.op, value: out };
    }

    case "coords-vectors.bschoi": {
      const out = context.spice.raw.bschoi(step.key, step.values, step.order);
      return { op: step.op, value: out };
    }

    case "coords-vectors.bsrchc": {
      const out = context.spice.raw.bsrchc(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.bsrchd": {
      const out = context.spice.raw.bsrchd(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.bsrchi": {
      const out = context.spice.raw.bsrchi(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.isrchc": {
      const out = context.spice.raw.isrchc(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.isrchd": {
      const out = context.spice.raw.isrchd(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.isrchi": {
      const out = context.spice.raw.isrchi(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstlec": {
      const out = context.spice.raw.lstlec(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstled": {
      const out = context.spice.raw.lstled(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstlei": {
      const out = context.spice.raw.lstlei(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstltc": {
      const out = context.spice.raw.lstltc(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstltd": {
      const out = context.spice.raw.lstltd(step.key, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lstlti": {
      const out = context.spice.raw.lstlti(step.key, step.values);
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
