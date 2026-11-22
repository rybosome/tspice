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
  StepCoordsVectorsChbder,
  StepCoordsVectorsChbigr,
  StepCoordsVectorsChbint,
  StepCoordsVectorsChbval,
  StepCoordsVectorsPolyds,
  StepCoordsVectorsRquad,
  StepCoordsVectorsHrmesp,
  StepCoordsVectorsHrmint,
  StepCoordsVectorsLgresp,
  StepCoordsVectorsLgrind,
  StepCoordsVectorsLgrint,
  StepCoordsVectorsQderiv,
  StepCoordsVectorsClearc,
  StepCoordsVectorsCleard,
  StepCoordsVectorsCleari,
  StepCoordsVectorsFilld,
  StepCoordsVectorsFilli,
  StepCoordsVectorsMoved,
  StepCoordsVectorsEul2m,
  StepCoordsVectorsM2eul,
  StepCoordsVectorsM2q,
  StepCoordsVectorsQ2m,
  StepCoordsVectorsQxq,
  StepCoordsVectorsQdq2av,
  StepCoordsVectorsRaxisa,
  StepCoordsVectorsDet,
  StepCoordsVectorsDiags2,
  StepCoordsVectorsIdent,
  StepCoordsVectorsInvert,
  StepCoordsVectorsInvort,
  StepCoordsVectorsIsrot,
  StepCoordsVectorsMequ,
  StepCoordsVectorsMtxm,
  StepCoordsVectorsMxmt,
  StepCoordsVectorsTrace,
  StepCoordsVectorsXpose,
  StepCoordsVectorsMequg,
  StepCoordsVectorsMtxmg,
  StepCoordsVectorsMtxvg,
  StepCoordsVectorsMxmg,
  StepCoordsVectorsMxmtg,
  StepCoordsVectorsMxvg,
  StepCoordsVectorsVtmvg,
  StepCoordsVectorsXposeg,
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
  StepCoordsVectorsDazldr,
  StepCoordsVectorsDcyldr,
  StepCoordsVectorsDgeodr,
  StepCoordsVectorsDlatdr,
  StepCoordsVectorsDpgrdr,
  StepCoordsVectorsDrdazl,
  StepCoordsVectorsDrdcyl,
  StepCoordsVectorsDrdgeo,
  StepCoordsVectorsDrdlat,
  StepCoordsVectorsDrdpgr,
  StepCoordsVectorsDrdsph,
  StepCoordsVectorsDsphdr,
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
  | StepCoordsVectorsChbder
  | StepCoordsVectorsChbigr
  | StepCoordsVectorsChbint
  | StepCoordsVectorsChbval
  | StepCoordsVectorsPolyds
  | StepCoordsVectorsRquad
  | StepCoordsVectorsHrmesp
  | StepCoordsVectorsHrmint
  | StepCoordsVectorsLgresp
  | StepCoordsVectorsLgrind
  | StepCoordsVectorsLgrint
  | StepCoordsVectorsQderiv
  | StepCoordsVectorsClearc
  | StepCoordsVectorsCleard
  | StepCoordsVectorsCleari
  | StepCoordsVectorsFilld
  | StepCoordsVectorsFilli
  | StepCoordsVectorsMoved
  | StepCoordsVectorsEul2m
  | StepCoordsVectorsM2eul
  | StepCoordsVectorsM2q
  | StepCoordsVectorsQ2m
  | StepCoordsVectorsQxq
  | StepCoordsVectorsQdq2av
  | StepCoordsVectorsRaxisa
  | StepCoordsVectorsDet
  | StepCoordsVectorsDiags2
  | StepCoordsVectorsIdent
  | StepCoordsVectorsInvert
  | StepCoordsVectorsInvort
  | StepCoordsVectorsIsrot
  | StepCoordsVectorsMequ
  | StepCoordsVectorsMtxm
  | StepCoordsVectorsMxmt
  | StepCoordsVectorsTrace
  | StepCoordsVectorsXpose
  | StepCoordsVectorsMequg
  | StepCoordsVectorsMtxmg
  | StepCoordsVectorsMtxvg
  | StepCoordsVectorsMxmg
  | StepCoordsVectorsMxmtg
  | StepCoordsVectorsMxvg
  | StepCoordsVectorsVtmvg
  | StepCoordsVectorsXposeg
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
  | StepCoordsVectorsDazldr
  | StepCoordsVectorsDcyldr
  | StepCoordsVectorsDgeodr
  | StepCoordsVectorsDlatdr
  | StepCoordsVectorsDpgrdr
  | StepCoordsVectorsDrdazl
  | StepCoordsVectorsDrdcyl
  | StepCoordsVectorsDrdgeo
  | StepCoordsVectorsDrdlat
  | StepCoordsVectorsDrdpgr
  | StepCoordsVectorsDrdsph
  | StepCoordsVectorsDsphdr
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

    case "coords-vectors.chbder": {
      const out = context.spice.raw.chbder(
        step.cp,
        step.x2s,
        step.x,
        step.nderiv,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.chbigr": {
      const out = context.spice.raw.chbigr(step.cp, step.x2s, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.chbint": {
      const out = context.spice.raw.chbint(step.cp, step.x2s, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.chbval": {
      const out = context.spice.raw.chbval(step.cp, step.x2s, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.polyds": {
      const out = context.spice.raw.polyds(step.coeffs, step.nderiv, step.t);
      return { op: step.op, value: out };
    }

    case "coords-vectors.rquad": {
      const out = context.spice.raw.rquad(step.a, step.b, step.c);
      return { op: step.op, value: out };
    }

    case "coords-vectors.hrmesp": {
      const out = context.spice.raw.hrmesp(
        step.first,
        step.step,
        step.yvals,
        step.x,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.hrmint": {
      const out = context.spice.raw.hrmint(step.xvals, step.yvals, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lgresp": {
      const out = context.spice.raw.lgresp(
        step.first,
        step.step,
        step.yvals,
        step.x,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.lgrind": {
      const out = context.spice.raw.lgrind(step.xvals, step.yvals, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.lgrint": {
      const out = context.spice.raw.lgrint(step.xvals, step.yvals, step.x);
      return { op: step.op, value: out };
    }

    case "coords-vectors.qderiv": {
      const out = context.spice.raw.qderiv(step.f0, step.f2, step.delta);
      return { op: step.op, value: out };
    }

    case "coords-vectors.clearc": {
      const out = context.spice.raw.clearc(step.ndim, step.arrlen, step.bytes);
      return { op: step.op, value: out };
    }

    case "coords-vectors.cleard": {
      const out = context.spice.raw.cleard(step.ndim, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.cleari": {
      const out = context.spice.raw.cleari(step.ndim, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.filld": {
      const out = context.spice.raw.filld(step.value, step.ndim, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.filli": {
      const out = context.spice.raw.filli(step.value, step.ndim, step.values);
      return { op: step.op, value: out };
    }

    case "coords-vectors.moved": {
      const out = context.spice.raw.moved(
        step.source,
        step.ndim,
        step.destination,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.eul2m":
      return {
        op: step.op,
        value: unflattenMatrix(
          context.spice.raw.eul2m(
            step.angle3,
            step.angle2,
            step.angle1,
            step.axis3,
            step.axis2,
            step.axis1,
          ),
        ),
      };
    case "coords-vectors.m2eul":
      return {
        op: step.op,
        value: context.spice.raw.m2eul(
          flattenMatrix(step.m),
          step.axis3,
          step.axis2,
          step.axis1,
        ),
      };
    case "coords-vectors.m2q":
      return {
        op: step.op,
        value: context.spice.raw.m2q(flattenMatrix(step.m)),
      };
    case "coords-vectors.q2m":
      return {
        op: step.op,
        value: unflattenMatrix(context.spice.raw.q2m(step.q)),
      };
    case "coords-vectors.qxq":
      return { op: step.op, value: context.spice.raw.qxq(step.q1, step.q2) };
    case "coords-vectors.qdq2av":
      return { op: step.op, value: context.spice.raw.qdq2av(step.q, step.dq) };
    case "coords-vectors.raxisa":
      return {
        op: step.op,
        value: context.spice.raw.raxisa(flattenMatrix(step.m)),
      };
    case "coords-vectors.dazldr": {
      const out = context.spice.raw.dazldr(
        step.x,
        step.y,
        step.z,
        step.azccw,
        step.elplsz,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.dcyldr": {
      const out = context.spice.raw.dcyldr(step.x, step.y, step.z);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.dgeodr": {
      const out = context.spice.raw.dgeodr(
        step.x,
        step.y,
        step.z,
        step.re,
        step.f,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.dlatdr": {
      const out = context.spice.raw.dlatdr(step.x, step.y, step.z);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.dpgrdr": {
      const out = context.spice.raw.dpgrdr(
        step.body,
        step.x,
        step.y,
        step.z,
        step.re,
        step.f,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdazl": {
      const out = context.spice.raw.drdazl(
        step.range,
        step.az,
        step.el,
        step.azccw,
        step.elplsz,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdcyl": {
      const out = context.spice.raw.drdcyl(step.radius, step.lon, step.z);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdgeo": {
      const out = context.spice.raw.drdgeo(
        step.lon,
        step.lat,
        step.alt,
        step.re,
        step.f,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdlat": {
      const out = context.spice.raw.drdlat(step.radius, step.lon, step.lat);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdpgr": {
      const out = context.spice.raw.drdpgr(
        step.body,
        step.lon,
        step.lat,
        step.alt,
        step.re,
        step.f,
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.drdsph": {
      const out = context.spice.raw.drdsph(step.radius, step.colat, step.lon);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.dsphdr": {
      const out = context.spice.raw.dsphdr(step.x, step.y, step.z);
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.det": {
      const out = context.spice.raw.det(flattenMatrix(step.m));
      return { op: step.op, value: out };
    }

    case "coords-vectors.diags2": {
      const out = context.spice.raw.diags2(step.symmat);
      return { op: step.op, value: out };
    }

    case "coords-vectors.ident": {
      const out = context.spice.raw.ident();
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.invert": {
      const out = context.spice.raw.invert(flattenMatrix(step.m));
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.invort": {
      const out = context.spice.raw.invort(flattenMatrix(step.m));
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.isrot": {
      const out = context.spice.raw.isrot(
        flattenMatrix(step.m),
        step.ntol,
        step.dtol,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.mequ": {
      const out = context.spice.raw.mequ(flattenMatrix(step.m));
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.mtxm": {
      const out = context.spice.raw.mtxm(
        flattenMatrix(step.a),
        flattenMatrix(step.b),
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.mxmt": {
      const out = context.spice.raw.mxmt(
        flattenMatrix(step.a),
        flattenMatrix(step.b),
      );
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.trace": {
      const out = context.spice.raw.trace(flattenMatrix(step.m));
      return { op: step.op, value: out };
    }

    case "coords-vectors.xpose": {
      const out = context.spice.raw.xpose(flattenMatrix(step.m));
      return { op: step.op, value: unflattenMatrix(out) };
    }

    case "coords-vectors.mequg": {
      const out = context.spice.raw.mequg(step.m1, step.nr, step.nc);
      return { op: step.op, value: out };
    }

    case "coords-vectors.mtxmg": {
      const out = context.spice.raw.mtxmg(
        step.m1,
        step.m2,
        step.nc1,
        step.nr1r2,
        step.nc2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.mtxvg": {
      const out = context.spice.raw.mtxvg(
        step.m1,
        step.v2,
        step.nc1,
        step.nr1r2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.mxmg": {
      const out = context.spice.raw.mxmg(
        step.m1,
        step.m2,
        step.nr1,
        step.nc1r2,
        step.nc2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.mxmtg": {
      const out = context.spice.raw.mxmtg(
        step.m1,
        step.m2,
        step.nr1,
        step.nc1c2,
        step.nr2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.mxvg": {
      const out = context.spice.raw.mxvg(
        step.m1,
        step.v2,
        step.nr1,
        step.nc1r2,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.vtmvg": {
      const out = context.spice.raw.vtmvg(
        step.v1,
        step.matrix,
        step.v2,
        step.nrow,
        step.ncol,
      );
      return { op: step.op, value: out };
    }

    case "coords-vectors.xposeg": {
      const out = context.spice.raw.xposeg(step.matrix, step.nrow, step.ncol);
      return { op: step.op, value: out };
    }

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
