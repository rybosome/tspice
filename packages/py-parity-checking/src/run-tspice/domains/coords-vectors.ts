import type {
  StepCoordsVectorsAxisar,
  StepCoordsVectorsGeorec,
  StepCoordsVectorsLatrec,
  StepCoordsVectorsMtxv,
  StepCoordsVectorsMxm,
  StepCoordsVectorsMxv,
  StepCoordsVectorsCyllat,
  StepCoordsVectorsCylrec,
  StepCoordsVectorsCylsph,
  StepCoordsVectorsLatcyl,
  StepCoordsVectorsLatsph,
  StepCoordsVectorsReccyl,
  StepCoordsVectorsSphcyl,
  StepCoordsVectorsSphlat,
  StepCoordsVectorsVdist,
  StepCoordsVectorsVequ,
  StepCoordsVectorsVpack,
  StepCoordsVectorsVupack,
  StepCoordsVectorsVzero,
  StepCoordsVectorsUnorm,
  StepCoordsVectorsUcrss,
  StepCoordsVectorsVsep,
  StepCoordsVectorsVlcom,
  StepCoordsVectorsVlcom3,
  StepCoordsVectorsVperp,
  StepCoordsVectorsVproj,
  StepCoordsVectorsVrel,
  StepCoordsVectorsVrotv,
  StepCoordsVectorsRotvec,
  StepCoordsVectorsVtmv,
  StepCoordsVectorsAzlrec,
  StepCoordsVectorsRecazl,
  StepCoordsVectorsPgrrec,
  StepCoordsVectorsRecpgr,
  StepCoordsVectorsRadrec,
  StepCoordsVectorsRecrad,
  StepCoordsVectorsSrfrec,
  StepCoordsVectorsBrcktd,
  StepCoordsVectorsBrckti,
  StepCoordsVectorsConvrt,
  StepCoordsVectorsSumad,
  StepCoordsVectorsSumai,
  StepCoordsVectorsMaxd,
  StepCoordsVectorsMaxi,
  StepCoordsVectorsMind,
  StepCoordsVectorsMini,
  StepCoordsVectorsDucrss,
  StepCoordsVectorsDvcrss,
  StepCoordsVectorsDvdot,
  StepCoordsVectorsDvhat,
  StepCoordsVectorsDvnorm,
  StepCoordsVectorsDvsep,
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
  StepCoordsVectorsPi,
  StepCoordsVectorsTwopi,
  StepCoordsVectorsHalfpi,
  StepCoordsVectorsDpr,
  StepCoordsVectorsRpd,
  StepCoordsVectorsClight,
  StepCoordsVectorsDpmax,
  StepCoordsVectorsDpmin,
  StepCoordsVectorsIntmax,
  StepCoordsVectorsIntmin,
  StepCoordsVectorsVnorm,
  StepCoordsVectorsVscl,
  StepCoordsVectorsVsub,
  StepOutput,
  Vector3,
} from "../../case-types.js";
import type { RunTspiceContext } from "../context.js";
import { flattenMatrix, unflattenMatrix } from "../utils/matrix.js";

type CoordsVectorsStep =
  | StepCoordsVectorsCyllat
  | StepCoordsVectorsCylrec
  | StepCoordsVectorsCylsph
  | StepCoordsVectorsLatcyl
  | StepCoordsVectorsLatsph
  | StepCoordsVectorsReccyl
  | StepCoordsVectorsSphcyl
  | StepCoordsVectorsSphlat
  | StepCoordsVectorsVdist
  | StepCoordsVectorsVequ
  | StepCoordsVectorsVpack
  | StepCoordsVectorsVupack
  | StepCoordsVectorsVzero
  | StepCoordsVectorsUnorm
  | StepCoordsVectorsUcrss
  | StepCoordsVectorsVsep
  | StepCoordsVectorsVlcom
  | StepCoordsVectorsVlcom3
  | StepCoordsVectorsVperp
  | StepCoordsVectorsVproj
  | StepCoordsVectorsVrel
  | StepCoordsVectorsVrotv
  | StepCoordsVectorsRotvec
  | StepCoordsVectorsVtmv
  | StepCoordsVectorsAzlrec
  | StepCoordsVectorsRecazl
  | StepCoordsVectorsPgrrec
  | StepCoordsVectorsRecpgr
  | StepCoordsVectorsRadrec
  | StepCoordsVectorsRecrad
  | StepCoordsVectorsSrfrec
  | StepCoordsVectorsBrcktd
  | StepCoordsVectorsBrckti
  | StepCoordsVectorsConvrt
  | StepCoordsVectorsSumad
  | StepCoordsVectorsSumai
  | StepCoordsVectorsMaxd
  | StepCoordsVectorsMaxi
  | StepCoordsVectorsMind
  | StepCoordsVectorsMini
  | StepCoordsVectorsDucrss
  | StepCoordsVectorsDvcrss
  | StepCoordsVectorsDvdot
  | StepCoordsVectorsDvhat
  | StepCoordsVectorsDvnorm
  | StepCoordsVectorsDvsep
  | StepCoordsVectorsReclat
  | StepCoordsVectorsLatrec
  | StepCoordsVectorsRecsph
  | StepCoordsVectorsSphrec
  | StepCoordsVectorsPi
  | StepCoordsVectorsTwopi
  | StepCoordsVectorsHalfpi
  | StepCoordsVectorsDpr
  | StepCoordsVectorsRpd
  | StepCoordsVectorsClight
  | StepCoordsVectorsDpmax
  | StepCoordsVectorsDpmin
  | StepCoordsVectorsIntmax
  | StepCoordsVectorsIntmin
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
    case "coords-vectors.pi":
      return { op: step.op, value: context.spice.raw.pi() };

    case "coords-vectors.twopi":
      return { op: step.op, value: context.spice.raw.twopi() };

    case "coords-vectors.halfpi":
      return { op: step.op, value: context.spice.raw.halfpi() };

    case "coords-vectors.dpr":
      return { op: step.op, value: context.spice.raw.dpr() };

    case "coords-vectors.rpd":
      return { op: step.op, value: context.spice.raw.rpd() };

    case "coords-vectors.clight":
      return { op: step.op, value: context.spice.raw.clight() };

    case "coords-vectors.dpmax":
      return { op: step.op, value: context.spice.raw.dpmax() };

    case "coords-vectors.dpmin":
      return { op: step.op, value: context.spice.raw.dpmin() };

    case "coords-vectors.intmax":
      return { op: step.op, value: context.spice.raw.intmax() };

    case "coords-vectors.intmin":
      return { op: step.op, value: context.spice.raw.intmin() };

    case "coords-vectors.cyllat": {
      const out = context.spice.raw.cyllat(step.radius, step.lon, step.z);
      return { op: step.op, value: out };
    }

    case "coords-vectors.cylrec": {
      const out = context.spice.raw.cylrec(step.radius, step.lon, step.z);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.cylsph": {
      const out = context.spice.raw.cylsph(step.radius, step.lon, step.z);
      return { op: step.op, value: out };
    }

    case "coords-vectors.latcyl": {
      const out = context.spice.raw.latcyl(step.radius, step.lon, step.lat);
      return { op: step.op, value: out };
    }

    case "coords-vectors.latsph": {
      const out = context.spice.raw.latsph(step.radius, step.lon, step.lat);
      return { op: step.op, value: out };
    }

    case "coords-vectors.reccyl": {
      const out = context.spice.raw.reccyl(step.rectan);
      return { op: step.op, value: out };
    }

    case "coords-vectors.sphcyl": {
      const out = context.spice.raw.sphcyl(step.radius, step.colat, step.lon);
      return { op: step.op, value: out };
    }

    case "coords-vectors.sphlat": {
      const out = context.spice.raw.sphlat(step.radius, step.colat, step.lon);
      return { op: step.op, value: out };
    }

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

    case "coords-vectors.vlcom": {
      const out = context.spice.raw.vlcom(step.a, step.v1, step.b, step.v2);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vlcom3": {
      const out = context.spice.raw.vlcom3(
        step.a,
        step.v1,
        step.b,
        step.v2,
        step.c,
        step.v3,
      );
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vperp": {
      const out = context.spice.raw.vperp(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vproj": {
      const out = context.spice.raw.vproj(step.a, step.b);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vrel": {
      const out = context.spice.raw.vrel(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.vrotv": {
      const out = context.spice.raw.vrotv(step.v, step.axis, step.theta);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.rotvec": {
      const out = context.spice.raw.rotvec(step.v, step.angle, step.axis);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.vtmv": {
      const out = context.spice.raw.vtmv(
        step.v1,
        flattenMatrix(step.matrix),
        step.v2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.azlrec": {
      const out = context.spice.raw.azlrec(
        step.range,
        step.az,
        step.el,
        step.azccw,
        step.elplsz,
      );
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.recazl": {
      const out = context.spice.raw.recazl(step.rect, step.azccw, step.elplsz);
      return { op: step.op, value: out };
    }

    case "coords-vectors.pgrrec": {
      const out = context.spice.raw.pgrrec(
        step.body,
        step.lon,
        step.lat,
        step.alt,
        step.re,
        step.f,
      );
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.recpgr": {
      const out = context.spice.raw.recpgr(
        step.body,
        step.rect,
        step.re,
        step.f,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.radrec": {
      const out = context.spice.raw.radrec(step.range, step.ra, step.dec);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.recrad": {
      const out = context.spice.raw.recrad(step.rect);
      return { op: step.op, value: out };
    }

    case "coords-vectors.srfrec": {
      const out = context.spice.raw.srfrec(step.body, step.lon, step.lat);
      return { op: step.op, value: toVector3(out) };
    }

    case "coords-vectors.brcktd": {
      const out = context.spice.raw.brcktd(step.value, step.end1, step.end2);
      return { op: step.op, value: out };
    }

    case "coords-vectors.brckti": {
      const out = context.spice.raw.brckti(step.value, step.end1, step.end2);
      return { op: step.op, value: out };
    }

    case "coords-vectors.convrt": {
      const out = context.spice.raw.convrt(
        step.value,
        step.inUnit,
        step.outUnit,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.sumad": {
      const out = context.spice.raw.sumad(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.sumai": {
      const out = context.spice.raw.sumai(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.maxd": {
      const out = context.spice.raw.maxd(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.maxi": {
      const out = context.spice.raw.maxi(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.mind": {
      const out = context.spice.raw.mind(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.mini": {
      const out = context.spice.raw.mini(step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.ducrss": {
      const out = context.spice.raw.ducrss(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.dvcrss": {
      const out = context.spice.raw.dvcrss(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.dvdot": {
      const out = context.spice.raw.dvdot(step.a, step.b);
      return { op: step.op, value: out };
    }

    case "coords-vectors.dvhat": {
      const out = context.spice.raw.dvhat(step.state);
      return { op: step.op, value: out };
    }

    case "coords-vectors.dvnorm": {
      const out = context.spice.raw.dvnorm(step.state);
      return { op: step.op, value: out };
    }

    case "coords-vectors.dvsep": {
      const out = context.spice.raw.dvsep(step.a, step.b);
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
