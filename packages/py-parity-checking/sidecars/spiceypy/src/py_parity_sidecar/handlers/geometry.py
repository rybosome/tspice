from __future__ import annotations

from ctypes import c_double

import spiceypy as sp
import spiceypy.utils.support_types as stypes

from .. import field_of_view_oracle
from .. import geometry_quantities_oracle
from ..models import (
    StepGeometryIlumin,
    StepGeometryIllumf,
    StepGeometryIllumg,
    StepGeometryNvc2pl,
    StepGeometryGetfov,
    StepGeometryGetfvn,
    StepGeometryFovray,
    StepGeometryFovtrg,
    StepGeometryPhaseq,
    StepGeometryLspcn,
    StepGeometryTrgsep,
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
        # Check the real toolkit error before reading found. The default
        # found decorator otherwise hides BADMETHODSYNTAX as NotFoundError.
        with sp.no_found_check():
            spoint, trgepc, srfvec, found = sp.sincpt(
                step.method,
                step.target,
                step.et,
                step.fixref,
                step.abcorr,
                step.observer,
                step.dref,
                step.dvec,
            )
        if not found:
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

    if isinstance(step, StepGeometryGetfov):
        return StepOutput(op=step.op, value=field_of_view_oracle.getfov(step.instid, step.room, step.shapelen, step.framelen))

    if isinstance(step, StepGeometryGetfvn):
        return StepOutput(op=step.op, value=field_of_view_oracle.getfvn(step.inst, step.room, step.shapelen, step.framelen))

    if isinstance(step, StepGeometryFovray):
        return StepOutput(op=step.op, value=field_of_view_oracle.fovray(step.inst, step.raydir, step.rframe, step.abcorr, step.observer, step.et))

    if isinstance(step, StepGeometryFovtrg):
        return StepOutput(op=step.op, value=field_of_view_oracle.fovtrg(step.inst, step.target, step.tshape, step.tframe, step.abcorr, step.observer, step.et))

    if isinstance(step, StepGeometryPhaseq):
        return StepOutput(op=step.op, value=geometry_quantities_oracle.phaseq(step.et, step.target, step.illmn, step.observer, step.abcorr))

    if isinstance(step, StepGeometryLspcn):
        return StepOutput(op=step.op, value=geometry_quantities_oracle.lspcn(step.body, step.et, step.abcorr))

    if isinstance(step, StepGeometryTrgsep):
        return StepOutput(op=step.op, value=geometry_quantities_oracle.trgsep(step.et, step.targ1, step.shape1, step.frame1, step.targ2, step.shape2, step.frame2, step.observer, step.abcorr))

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
