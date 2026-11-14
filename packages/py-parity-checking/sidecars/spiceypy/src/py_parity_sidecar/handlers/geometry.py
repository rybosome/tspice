from __future__ import annotations

from ctypes import c_double

import spiceypy as sp
import spiceypy.utils.support_types as stypes

from ..models import (
    StepGeometryIlumin,
    StepGeometryIllumf,
    StepGeometryIllumg,
    StepGeometryNvp2pl,
    StepGeometryPl2nvp,
    StepGeometryPl2psv,
    StepGeometryPsv2pl,
    StepGeometryInrypl,
    StepGeometryVprjp,
    StepGeometryVprjpi,
    StepGeometryNplnpt,
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


def _stored_plane(values: tuple[float, float, float, float]) -> stypes.Plane:
    # Reconstruct the exact four caller-supplied plane words. Re-running a
    # construction routine here would normalize them a second time.
    return stypes.Plane(_normal=(c_double * 3)(*values[:3]), _constant=values[3])


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

    if isinstance(step, StepGeometryNvp2pl):
        out = sp.nvp2pl(step.normal, step.point)
        return StepOutput(op=step.op, value=[float(x) for x in out.normal] + [float(out.constant)])

    if isinstance(step, StepGeometryPl2nvp):
        out = sp.pl2nvp(_stored_plane(step.plane))
        return StepOutput(op=step.op, value={"normal": _vec3_to_json(out[0]), "point": _vec3_to_json(out[1])})

    if isinstance(step, StepGeometryPl2psv):
        out = sp.pl2psv(_stored_plane(step.plane))
        return StepOutput(op=step.op, value={"point": _vec3_to_json(out[0]), "span1": _vec3_to_json(out[1]), "span2": _vec3_to_json(out[2])})

    if isinstance(step, StepGeometryPsv2pl):
        out = sp.psv2pl(step.point, step.span1, step.span2)
        return StepOutput(op=step.op, value=[float(x) for x in out.normal] + [float(out.constant)])

    if isinstance(step, StepGeometryInrypl):
        out = sp.inrypl(step.vertex, step.dir, _stored_plane(step.plane))
        return StepOutput(op=step.op, value={"nxpts": int(out[0]), "xpt": _vec3_to_json(out[1])})

    if isinstance(step, StepGeometryVprjp):
        out = sp.vprjp(step.vin, _stored_plane(step.plane))
        return StepOutput(op=step.op, value=_vec3_to_json(out))

    if isinstance(step, StepGeometryVprjpi):
        with sp.no_found_check():
            out, found = sp.vprjpi(step.vin, _stored_plane(step.projpl), _stored_plane(step.invpl))
        return StepOutput(op=step.op, value={"found": True, "vout": _vec3_to_json(out)} if found else {"found": False})

    if isinstance(step, StepGeometryNplnpt):
        out = sp.nplnpt(step.linpt, step.lindir, step.point)
        return StepOutput(op=step.op, value={"pnear": _vec3_to_json(out[0]), "dist": float(out[1])})

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
