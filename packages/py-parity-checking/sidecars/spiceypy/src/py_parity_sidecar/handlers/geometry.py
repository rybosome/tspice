from __future__ import annotations

from ctypes import c_double

import spiceypy as sp
import spiceypy.utils.support_types as stypes
from spiceypy.utils.exceptions import NotFoundError

from ..models import (
    StepGeometryIlumin,
    StepGeometryIllumf,
    StepGeometryIllumg,
    StepGeometryNvc2pl,
    StepGeometryOccult,
    StepGeometryPl2nvc,
    StepGeometrySincpt,
    StepGeometrySubpnt,
    StepGeometrySubslr,
    StepOutput,
    WorkflowStep,
)


def _vec3_to_json(value: tuple[float, float, float] | list[float]) -> list[float]:
    return [float(value[0]), float(value[1]), float(value[2])]


def run_geometry_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepGeometrySubpnt):
        spoint, trgepc, srfvec = sp.subpnt(
            step.method,
            step.target,
            step.et,
            step.fixref,
            step.abcorr,
            step.observer,
        )
        return StepOutput(
            op=step.op,
            value={
                "spoint": _vec3_to_json(spoint),
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
            },
        )

    if isinstance(step, StepGeometrySubslr):
        spoint, trgepc, srfvec = sp.subslr(
            step.method,
            step.target,
            step.et,
            step.fixref,
            step.abcorr,
            step.observer,
        )
        return StepOutput(
            op=step.op,
            value={
                "spoint": _vec3_to_json(spoint),
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
            },
        )

    if isinstance(step, StepGeometrySincpt):
        try:
            spoint, trgepc, srfvec = sp.sincpt(
                step.method,
                step.target,
                step.et,
                step.fixref,
                step.abcorr,
                step.observer,
                step.dref,
                step.dvec,
            )
        except NotFoundError:
            if bool(sp.failed()):
                raise
            return StepOutput(op=step.op, value={"found": False})

        return StepOutput(
            op=step.op,
            value={
                "found": True,
                "spoint": _vec3_to_json(spoint),
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
            },
        )

    if isinstance(step, StepGeometryIlumin):
        trgepc, srfvec, phase, incdnc, emissn = sp.ilumin(
            step.method,
            step.target,
            step.et,
            step.fixref,
            step.abcorr,
            step.observer,
            step.spoint,
        )
        return StepOutput(
            op=step.op,
            value={
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
                "phase": float(phase),
                "incdnc": float(incdnc),
                "emissn": float(emissn),
            },
        )

    if isinstance(step, StepGeometryIllumg):
        trgepc, srfvec, phase, incdnc, emissn = sp.illumg(
            step.method,
            step.target,
            step.ilusrc,
            step.et,
            step.fixref,
            step.abcorr,
            step.observer,
            step.spoint,
        )
        return StepOutput(
            op=step.op,
            value={
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
                "phase": float(phase),
                "incdnc": float(incdnc),
                "emissn": float(emissn),
            },
        )

    if isinstance(step, StepGeometryIllumf):
        trgepc, srfvec, phase, incdnc, emissn, visibl, lit = sp.illumf(
            step.method,
            step.target,
            step.ilusrc,
            step.et,
            step.fixref,
            step.abcorr,
            step.observer,
            step.spoint,
        )
        return StepOutput(
            op=step.op,
            value={
                "trgepc": float(trgepc),
                "srfvec": _vec3_to_json(srfvec),
                "phase": float(phase),
                "incdnc": float(incdnc),
                "emissn": float(emissn),
                "visibl": bool(visibl),
                "lit": bool(lit),
            },
        )

    if isinstance(step, StepGeometryOccult):
        value = int(
            sp.occult(
                step.targ1,
                step.shape1,
                step.frame1,
                step.targ2,
                step.shape2,
                step.frame2,
                step.abcorr,
                step.observer,
                step.et,
            )
        )
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepGeometryNvc2pl):
        plane = sp.nvc2pl(step.normal, step.konst)
        return StepOutput(
            op=step.op,
            value=[
                float(plane.normal[0]),
                float(plane.normal[1]),
                float(plane.normal[2]),
                float(plane.constant),
            ],
        )

    if isinstance(step, StepGeometryPl2nvc):
        plane = stypes.Plane(
            _normal=(c_double * 3)(
                float(step.plane[0]),
                float(step.plane[1]),
                float(step.plane[2]),
            ),
            _constant=float(step.plane[3]),
        )
        normal, konst = sp.pl2nvc(plane)
        return StepOutput(
            op=step.op,
            value={
                "normal": _vec3_to_json(normal),
                "konst": float(konst),
            },
        )

    return None
