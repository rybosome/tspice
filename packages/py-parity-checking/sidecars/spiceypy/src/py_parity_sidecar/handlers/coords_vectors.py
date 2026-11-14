from __future__ import annotations

import spiceypy as sp

from .. import polynomial_oracle

from ..models import (
    StepCoordsVectorsAxisar,
    StepCoordsVectorsGeorec,
    StepCoordsVectorsLatrec,
    StepCoordsVectorsMtxv,
    StepCoordsVectorsMxm,
    StepCoordsVectorsMxv,
    StepCoordsVectorsChbder,
    StepCoordsVectorsChbigr,
    StepCoordsVectorsChbint,
    StepCoordsVectorsChbval,
    StepCoordsVectorsPolyds,
    StepCoordsVectorsRquad,
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
