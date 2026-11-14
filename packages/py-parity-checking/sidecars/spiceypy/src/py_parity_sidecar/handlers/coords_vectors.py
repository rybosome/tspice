from __future__ import annotations

import spiceypy as sp

from .. import interpolation_oracle

from ..models import (
    StepCoordsVectorsAxisar,
    StepCoordsVectorsGeorec,
    StepCoordsVectorsLatrec,
    StepCoordsVectorsMtxv,
    StepCoordsVectorsMxm,
    StepCoordsVectorsMxv,
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
    StepCoordsVectorsVnorm,
    StepCoordsVectorsVscl,
    StepCoordsVectorsVsub,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext


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
