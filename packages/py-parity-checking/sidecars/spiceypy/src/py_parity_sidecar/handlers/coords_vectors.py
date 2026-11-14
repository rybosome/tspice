from __future__ import annotations

import spiceypy as sp

from .. import general_matrix_oracle
from .. import general_vector_oracle

from ..models import (
    StepCoordsVectorsAxisar,
    StepCoordsVectorsGeorec,
    StepCoordsVectorsLatrec,
    StepCoordsVectorsMtxv,
    StepCoordsVectorsMxm,
    StepCoordsVectorsMxv,
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


def _to_general_vector(values: object, dimension: int) -> list[float]:
    out = values.tolist() if hasattr(values, "tolist") else values
    if not isinstance(out, list) or len(out) != dimension:
        raise TypeError(f"Expected {dimension} vector components, got {out!r}")
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
    if isinstance(step, StepCoordsVectorsMequg):
        result = general_matrix_oracle.mequg(step.m1, step.nr, step.nc)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsMtxmg):
        result = general_matrix_oracle.mtxmg(step.m1, step.m2, step.nc1, step.nr1r2, step.nc2)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsMtxvg):
        result = general_matrix_oracle.mtxvg(step.m1, step.v2, step.nc1, step.nr1r2)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsMxmg):
        result = general_matrix_oracle.mxmg(step.m1, step.m2, step.nr1, step.nc1r2, step.nc2)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsMxmtg):
        result = general_matrix_oracle.mxmtg(step.m1, step.m2, step.nr1, step.nc1c2, step.nr2)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsMxvg):
        result = general_matrix_oracle.mxvg(step.m1, step.v2, step.nr1, step.nc1r2)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsVtmvg):
        result = general_matrix_oracle.vtmvg(step.v1, step.matrix, step.v2, step.nrow, step.ncol)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsXposeg):
        result = general_matrix_oracle.xposeg(step.matrix, step.nrow, step.ncol)
        return StepOutput(op=step.op, value=result)

    if isinstance(step, StepCoordsVectorsVaddg):
        general_vector_oracle.validate_inputs("vaddg", step.a, step.b)
        out = general_vector_oracle.empty_result("vaddg") if len(step.a) == 0 else sp.vaddg(step.a, step.b)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.a)))

    if isinstance(step, StepCoordsVectorsVdistg):
        general_vector_oracle.validate_inputs("vdistg", step.a, step.b)
        out = sp.vdistg(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVdotg):
        general_vector_oracle.validate_inputs("vdotg", step.a, step.b)
        out = sp.vdotg(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVequg):
        general_vector_oracle.validate_inputs("vequg", step.v)
        out = general_vector_oracle.empty_result("vequg") if len(step.v) == 0 else sp.vequg(step.v)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.v)))

    if isinstance(step, StepCoordsVectorsVhatg):
        general_vector_oracle.validate_inputs("vhatg", step.v)
        out = general_vector_oracle.empty_result("vhatg") if len(step.v) == 0 else sp.vhatg(step.v)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.v)))

    if isinstance(step, StepCoordsVectorsVlcomg):
        general_vector_oracle.validate_scalar(step.a)
        general_vector_oracle.validate_scalar(step.b)
        general_vector_oracle.validate_inputs("vlcomg", step.v1, step.v2)
        out = general_vector_oracle.empty_result("vlcomg", a=step.a, b=step.b) if len(step.v1) == 0 else sp.vlcomg(len(step.v1), step.a, step.v1, step.b, step.v2)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.v1)))

    if isinstance(step, StepCoordsVectorsVminug):
        general_vector_oracle.validate_inputs("vminug", step.v)
        out = general_vector_oracle.empty_result("vminug") if len(step.v) == 0 else sp.vminug(step.v)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.v)))

    if isinstance(step, StepCoordsVectorsVnormg):
        general_vector_oracle.validate_inputs("vnormg", step.v)
        out = sp.vnormg(step.v)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVprojg):
        general_vector_oracle.validate_inputs("vprojg", step.a, step.b)
        out = general_vector_oracle.empty_result("vprojg") if len(step.a) == 0 else sp.vprojg(step.a, step.b)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.a)))

    if isinstance(step, StepCoordsVectorsVrelg):
        general_vector_oracle.validate_inputs("vrelg", step.a, step.b)
        out = sp.vrelg(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVsclg):
        general_vector_oracle.validate_scalar(step.s)
        general_vector_oracle.validate_inputs("vsclg", step.v)
        out = general_vector_oracle.empty_result("vsclg", s=step.s) if len(step.v) == 0 else sp.vsclg(step.s, step.v)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.v)))

    if isinstance(step, StepCoordsVectorsVsepg):
        general_vector_oracle.validate_inputs("vsepg", step.a, step.b)
        out = sp.vsepg(step.a, step.b)
        return StepOutput(op=step.op, value=float(out))

    if isinstance(step, StepCoordsVectorsVsubg):
        general_vector_oracle.validate_inputs("vsubg", step.a, step.b)
        out = general_vector_oracle.empty_result("vsubg") if len(step.a) == 0 else sp.vsubg(step.a, step.b)
        return StepOutput(op=step.op, value=_to_general_vector(out, len(step.a)))

    if isinstance(step, StepCoordsVectorsVzerog):
        general_vector_oracle.validate_inputs("vzerog", step.v)
        out = sp.vzerog(step.v)
        return StepOutput(op=step.op, value=bool(out))

    if isinstance(step, StepCoordsVectorsUnormg):
        general_vector_oracle.validate_inputs("unormg", step.v)
        unit, norm = general_vector_oracle.empty_result("unormg") if len(step.v) == 0 else sp.unormg(step.v)
        return StepOutput(op=step.op, value={"unit": _to_general_vector(unit, len(step.v)), "norm": float(norm)})

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
