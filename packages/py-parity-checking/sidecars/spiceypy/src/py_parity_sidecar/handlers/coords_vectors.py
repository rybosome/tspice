from __future__ import annotations

import spiceypy as sp

from .. import scalar_math_oracle

from .. import polynomial_oracle

from .. import interpolation_oracle

from ..models import (
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
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext


def _to_vec6(values: object) -> list[float]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != 6:
        raise TypeError(f"Expected length-6 state output, got: {out!r}")
    return [float(value) for value in out]


def _to_number_array(values: object, length: int) -> list[float]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != length:
        raise TypeError(f"Expected {length} numeric outputs, got: {out!r}")
    return [float(value) for value in out]


def _to_number_array(values: object, length: int) -> list[float]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != length:
        raise TypeError(f"Expected {length} numeric outputs, got: {out!r}")
    return [float(value) for value in out]


def _to_vec3(values: object) -> list[float]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != 3:
        raise TypeError(f"Expected length-3 vector output, got: {out!r}")
    return [float(out[0]), float(out[1]), float(out[2])]


def _to_matrix3x3(values: object) -> list[list[float]]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != 3:
        raise TypeError(f"Expected 3x3 matrix output, got: {out!r}")

    rows: list[list[float]] = []
    for row in out:
        if not isinstance(row, list) or len(row) != 3:
            raise TypeError(f"Expected matrix row length 3, got: {row!r}")
        rows.append([float(row[0]), float(row[1]), float(row[2])])

    return rows


def run_coords_vectors_step(step: WorkflowStep, _context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepCoordsVectorsCyllat):
        radius, lon, lat = sp.cyllat(step.radius, step.lon, step.z)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "lat": float(lat)})

    if isinstance(step, StepCoordsVectorsCylrec):
        out = sp.cylrec(step.radius, step.lon, step.z)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsCylsph):
        radius, colat, lon = sp.cylsph(step.radius, step.lon, step.z)
        return StepOutput(op=step.op, value={"radius": float(radius), "colat": float(colat), "lon": float(lon)})

    if isinstance(step, StepCoordsVectorsLatcyl):
        radius, lon, z = sp.latcyl(step.radius, step.lon, step.lat)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "z": float(z)})

    if isinstance(step, StepCoordsVectorsLatsph):
        radius, colat, lon = sp.latsph(step.radius, step.lon, step.lat)
        return StepOutput(op=step.op, value={"radius": float(radius), "colat": float(colat), "lon": float(lon)})

    if isinstance(step, StepCoordsVectorsReccyl):
        radius, lon, z = sp.reccyl(step.rectan)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "z": float(z)})

    if isinstance(step, StepCoordsVectorsSphcyl):
        radius, lon, z = sp.sphcyl(step.radius, step.colat, step.lon)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "z": float(z)})

    if isinstance(step, StepCoordsVectorsSphlat):
        radius, lon, lat = sp.sphlat(step.radius, step.colat, step.lon)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "lat": float(lat)})

    if isinstance(step, StepCoordsVectorsVdist):
        out = sp.vdist(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVequ):
        out = sp.vequ(step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVpack):
        out = sp.vpack(step.x, step.y, step.z)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVupack):
        x, y, z = sp.vupack(step.v)
        return StepOutput(op=step.op, value={"x": float(x), "y": float(y), "z": float(z)})

    if isinstance(step, StepCoordsVectorsVzero):
        out = sp.vzero(step.v)
        return StepOutput(op=step.op, value=bool(out))

    if isinstance(step, StepCoordsVectorsUnorm):
        unit, norm = sp.unorm(step.v)
        return StepOutput(op=step.op, value={"unit": _to_vec3(unit), "norm": float(norm)})

    if isinstance(step, StepCoordsVectorsUcrss):
        out = sp.ucrss(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVsep):
        out = sp.vsep(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVlcom):
        out = sp.vlcom(step.a, step.v1, step.b, step.v2)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVlcom3):
        out = sp.vlcom3(step.a, step.v1, step.b, step.v2, step.c, step.v3)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVperp):
        out = sp.vperp(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVproj):
        out = sp.vproj(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVrel):
        out = sp.vrel(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVrotv):
        out = sp.vrotv(step.v, step.axis, step.theta)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRotvec):
        out = sp.rotvec(step.v, step.angle, step.axis)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVtmv):
        out = sp.vtmv(step.v1, step.matrix, step.v2)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsAzlrec):
        out = sp.azlrec(step.range, step.az, step.el, step.azccw, step.elplsz)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRecazl):
        value0, value1, value2 = sp.recazl(step.rect, step.azccw, step.elplsz)
        return StepOutput(op=step.op, value={"range": float(value0), "az": float(value1), "el": float(value2)})

    if isinstance(step, StepCoordsVectorsPgrrec):
        out = sp.pgrrec(step.body, step.lon, step.lat, step.alt, step.re, step.f)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRecpgr):
        value0, value1, value2 = sp.recpgr(step.body, step.rect, step.re, step.f)
        return StepOutput(op=step.op, value={"lon": float(value0), "lat": float(value1), "alt": float(value2)})

    if isinstance(step, StepCoordsVectorsRadrec):
        out = sp.radrec(step.range, step.ra, step.dec)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRecrad):
        value0, value1, value2 = sp.recrad(step.rect)
        return StepOutput(op=step.op, value={"range": float(value0), "ra": float(value1), "dec": float(value2)})

    if isinstance(step, StepCoordsVectorsSrfrec):
        out = sp.srfrec(step.body, step.lon, step.lat)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsBrcktd):
        out = sp.brcktd(step.value, step.end1, step.end2)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsBrckti):
        out = sp.brckti(step.value, step.end1, step.end2)
        return StepOutput(op=step.op, value=int(out))

    if isinstance(step, StepCoordsVectorsConvrt):
        out = sp.convrt(step.value, step.inUnit, step.outUnit)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsSumad):
        out = sp.sumad(step.values)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsSumai):
        out = scalar_math_oracle.sumai(step.values)
        return StepOutput(op=step.op, value=int(out))

    if isinstance(step, StepCoordsVectorsMaxd):
        out = scalar_math_oracle.maxd(step.values)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsMaxi):
        out = scalar_math_oracle.maxi(step.values)
        return StepOutput(op=step.op, value=int(out))

    if isinstance(step, StepCoordsVectorsMind):
        out = scalar_math_oracle.mind(step.values)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsMini):
        out = scalar_math_oracle.mini(step.values)
        return StepOutput(op=step.op, value=int(out))

    if isinstance(step, StepCoordsVectorsDucrss):
        out = sp.ducrss(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec6(out))

    if isinstance(step, StepCoordsVectorsDvcrss):
        out = sp.dvcrss(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec6(out))

    if isinstance(step, StepCoordsVectorsDvdot):
        out = sp.dvdot(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsDvhat):
        out = sp.dvhat(step.state)
        return StepOutput(op=step.op, value=_to_vec6(out))

    if isinstance(step, StepCoordsVectorsDvnorm):
        out = sp.dvnorm(step.state)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsDvsep):
        out = sp.dvsep(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsChbder):
        polynomial_oracle.derivative_order(step.nderiv, chebyshev=True)
        polynomial_oracle.chebyshev_inputs(step.cp, step.x2s, step.x)
        out = sp.chbder(step.cp, len(step.cp) - 1, step.x2s, step.x, step.nderiv)
        return StepOutput(op=step.op, value=_to_number_array(out, step.nderiv + 1))

    if isinstance(step, StepCoordsVectorsChbigr):
        polynomial_oracle.chebyshev_inputs(step.cp, step.x2s, step.x, integral=True)
        p, integral = sp.chbigr(len(step.cp) - 1, step.cp if step.cp else [0.0], step.x2s, step.x)
        return StepOutput(op=step.op, value={"p": float(p), "itgrlp": float(integral)})

    if isinstance(step, StepCoordsVectorsChbint):
        polynomial_oracle.chebyshev_inputs(step.cp, step.x2s, step.x)
        p, derivative = sp.chbint(step.cp, len(step.cp) - 1, step.x2s, step.x)
        return StepOutput(op=step.op, value={"p": float(p), "dpdx": float(derivative)})

    if isinstance(step, StepCoordsVectorsChbval):
        polynomial_oracle.chebyshev_inputs(step.cp, step.x2s, step.x)
        return StepOutput(op=step.op, value=float(sp.chbval(step.cp, len(step.cp) - 1, step.x2s, step.x)))

    if isinstance(step, StepCoordsVectorsPolyds):
        out = polynomial_oracle.polyds(step.coeffs, step.nderiv, step.t)
        return StepOutput(op=step.op, value=_to_number_array(out, max(0, step.nderiv + 1)))

    if isinstance(step, StepCoordsVectorsRquad):
        for coefficient in (step.a, step.b, step.c):
            polynomial_oracle.finite(coefficient)
        first, second = sp.rquad(step.a, step.b, step.c)
        return StepOutput(op=step.op, value={"root1": _to_number_array(first, 2), "root2": _to_number_array(second, 2)})

    if isinstance(step, StepCoordsVectorsHrmesp):
        interpolation_oracle.equally_spaced("hrmesp", step.first, step.step, step.yvals, step.x)
        value, derivative = sp.hrmesp(step.first, step.step, step.yvals, step.x)
        return StepOutput(op=step.op, value={"f": float(value), "df": float(derivative)})

    if isinstance(step, StepCoordsVectorsHrmint):
        interpolation_oracle.arbitrary("hrmint", step.xvals, step.yvals, step.x)
        value, derivative = sp.hrmint(step.xvals, step.yvals, step.x)
        return StepOutput(op=step.op, value={"f": float(value), "df": float(derivative)})

    if isinstance(step, StepCoordsVectorsLgresp):
        interpolation_oracle.equally_spaced("lgresp", step.first, step.step, step.yvals, step.x)
        return StepOutput(op=step.op, value=float(sp.lgresp(step.first, step.step, step.yvals, step.x)))

    if isinstance(step, StepCoordsVectorsLgrind):
        interpolation_oracle.arbitrary("lgrind", step.xvals, step.yvals, step.x)
        value, derivative = sp.lgrind(step.xvals, step.yvals, step.x)
        return StepOutput(op=step.op, value={"p": float(value), "dp": float(derivative)})

    if isinstance(step, StepCoordsVectorsLgrint):
        interpolation_oracle.arbitrary("lgrint", step.xvals, step.yvals, step.x)
        return StepOutput(op=step.op, value=float(sp.lgrint(step.xvals, step.yvals, step.x)))

    if isinstance(step, StepCoordsVectorsQderiv):
        interpolation_oracle.quadratic(step.f0, step.f2, step.delta)
        result = sp.qderiv(step.f0, step.f2, step.delta)
        return StepOutput(op=step.op, value=_to_number_array(result, len(step.f0)))

    if isinstance(step, StepCoordsVectorsReclat):
        radius, lon, lat = sp.reclat(step.rectan)
        return StepOutput(op=step.op, value={"radius": float(radius), "lon": float(lon), "lat": float(lat)})

    if isinstance(step, StepCoordsVectorsLatrec):
        out = sp.latrec(step.radius, step.lon, step.lat)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRecsph):
        radius, colat, lon = sp.recsph(step.rectan)
        return StepOutput(op=step.op, value={"radius": float(radius), "colat": float(colat), "lon": float(lon)})

    if isinstance(step, StepCoordsVectorsSphrec):
        out = sp.sphrec(step.radius, step.colat, step.lon)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsPi):
        return StepOutput(op=step.op, value=float(sp.pi()))

    if isinstance(step, StepCoordsVectorsTwopi):
        return StepOutput(op=step.op, value=float(sp.twopi()))

    if isinstance(step, StepCoordsVectorsHalfpi):
        return StepOutput(op=step.op, value=float(sp.halfpi()))

    if isinstance(step, StepCoordsVectorsDpr):
        return StepOutput(op=step.op, value=float(sp.dpr()))

    if isinstance(step, StepCoordsVectorsRpd):
        return StepOutput(op=step.op, value=float(sp.rpd()))

    if isinstance(step, StepCoordsVectorsClight):
        return StepOutput(op=step.op, value=float(sp.clight()))

    if isinstance(step, StepCoordsVectorsDpmax):
        return StepOutput(op=step.op, value=float(sp.dpmax()))

    if isinstance(step, StepCoordsVectorsDpmin):
        return StepOutput(op=step.op, value=float(sp.dpmin()))

    if isinstance(step, StepCoordsVectorsIntmax):
        return StepOutput(op=step.op, value=int(sp.intmax()))

    if isinstance(step, StepCoordsVectorsIntmin):
        return StepOutput(op=step.op, value=int(sp.intmin()))

    if isinstance(step, StepCoordsVectorsVnorm):
        out = sp.vnorm(step.v)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVhat):
        out = sp.vhat(step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVdot):
        out = sp.vdot(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVcrss):
        out = sp.vcrss(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVadd):
        out = sp.vadd(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVsub):
        out = sp.vsub(step.a, step.b)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVminus):
        out = sp.vminus(step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsVscl):
        out = sp.vscl(step.s, step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsMxm):
        out = sp.mxm(step.m1, step.m2)
        return StepOutput(op=step.op, value=_to_matrix3x3(out))

    if isinstance(step, StepCoordsVectorsRotate):
        out = sp.rotate(step.angle, step.axis)
        return StepOutput(op=step.op, value=_to_matrix3x3(out))

    if isinstance(step, StepCoordsVectorsRotmat):
        out = sp.rotmat(step.m, step.angle, step.axis)
        return StepOutput(op=step.op, value=_to_matrix3x3(out))

    if isinstance(step, StepCoordsVectorsAxisar):
        out = sp.axisar(step.axis, step.angle)
        return StepOutput(op=step.op, value=_to_matrix3x3(out))

    if isinstance(step, StepCoordsVectorsGeorec):
        out = sp.georec(step.lon, step.lat, step.alt, step.re, step.f)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsRecgeo):
        lon, lat, alt = sp.recgeo(step.rectan, step.re, step.f)
        return StepOutput(op=step.op, value={"lon": float(lon), "lat": float(lat), "alt": float(alt)})

    if isinstance(step, StepCoordsVectorsMxv):
        out = sp.mxv(step.m, step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    if isinstance(step, StepCoordsVectorsMtxv):
        out = sp.mtxv(step.m, step.v)
        return StepOutput(op=step.op, value=_to_vec3(out))

    return None
