"""Exact N0067 symbols absent from the locked SpiceyPy public wrapper table."""

import ctypes as c
import math
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceDLADescr
from .models.dsk import (
    StepDskIllumPl02,
    StepDskIllumPlidPl02,
    StepDskLimbPl02,
    StepDskLlgridPl02,
    StepDskSubptPl02,
    StepDskSubsolPl02,
    StepDskTermPl02,
)

_lib = c.CDLL(libspice._name)
D, I, S = c.c_double, c.c_int, c.c_char_p
PD, PI, PDS = c.POINTER(D), c.POINTER(I), c.POINTER(SpiceDLADescr)
assert c.sizeof(D) == 8 and c.sizeof(I) == 4 and c.sizeof(SpiceDLADescr) == 32


def _bind(name, signature):
    fn = getattr(_lib, name)
    fn.argtypes = [I, PDS, *signature]
    fn.restype = None
    return fn


_illum_pl02 = _bind("illum_pl02", [S, D, S, S, PD, PD, PD, PD])
_illum_plid_pl02 = _bind(
    "illum_plid_pl02", [S, D, S, S, PD, I, PD, PD, PD, PD, PD, PI, PI]
)
_limb_pl02 = _bind("limb_pl02", [S, D, S, S, S, I, PD, PD, PD, PI])
_llgrid_pl02 = _bind("llgrid_pl02", [I, PD, PD, PI])
_subpt_pl02 = _bind("subpt_pl02", [S, S, D, S, S, PD, PD, PI])
_subsol_pl02 = _bind("subsol_pl02", [S, S, D, S, S, PD, PD, PI])
_term_pl02 = _bind("term_pl02", [S, S, S, D, S, S, S, I, PD, PD, PD, PI])


def _text(value):
    data = value.encode("utf-8", "strict")
    if b"\0" in data or len(data) > 268435455:
        raise ValueError("Invalid legacy plate text")
    return data


def legacy_plate(step, handle, desc):
    """Allocate independent row-major C outputs and read them only on success."""
    common = [handle, c.byref(desc)]
    if isinstance(step, StepDskIllumPl02):
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        if not all(math.isfinite(v) for v in step.spoint):
            raise ValueError("Invalid surface point")
        spoint = (D * 3)(*step.spoint)
        phase = D()
        solar = D()
        emissn = D()
        _illum_pl02(
            *common,
            _text(step.target),
            step.et,
            _text(step.abcorr),
            _text(step.obsrvr),
            spoint,
            c.byref(phase),
            c.byref(solar),
            c.byref(emissn),
        )
        sp.check_for_spice_error(_illum_pl02)
        return {"phase": phase.value, "solar": solar.value, "emissn": emissn.value}
    if isinstance(step, StepDskIllumPlidPl02):
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        if not all(math.isfinite(v) for v in step.spoint):
            raise ValueError("Invalid surface point")
        spoint = (D * 3)(*step.spoint)
        if not -(2**31) <= step.plid < 2**31:
            raise ValueError("Invalid plate ID")
        trgepc = D()
        srfvec = (D * 3)()
        phase = D()
        solar = D()
        emissn = D()
        visible = I()
        lit = I()
        _illum_plid_pl02(
            *common,
            _text(step.target),
            step.et,
            _text(step.abcorr),
            _text(step.obsrvr),
            spoint,
            step.plid,
            c.byref(trgepc),
            srfvec,
            c.byref(phase),
            c.byref(solar),
            c.byref(emissn),
            c.byref(visible),
            c.byref(lit),
        )
        sp.check_for_spice_error(_illum_plid_pl02)
        return {
            "trgepc": trgepc.value,
            "srfvec": list(srfvec),
            "phase": phase.value,
            "solar": solar.value,
            "emissn": emissn.value,
            "visible": bool(visible.value),
            "lit": bool(lit.value),
        }
    if isinstance(step, StepDskLimbPl02):
        count = step.npts
        if not -(2**31) <= count <= (268435456 - 32) // 24:
            raise ValueError("Plate count out of range")
        rows = max(1, count)
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        trgepc = D()
        obspos = (D * 3)()
        lmbpts = (D * (3 * rows))()
        pltids = (I * rows)()
        _limb_pl02(
            *common,
            _text(step.target),
            step.et,
            _text(step.fixref),
            _text(step.abcorr),
            _text(step.obsrvr),
            count,
            c.byref(trgepc),
            obspos,
            lmbpts,
            pltids,
        )
        sp.check_for_spice_error(_limb_pl02)
        return {
            "trgepc": trgepc.value,
            "obspos": list(obspos),
            "lmbpts": [lmbpts[3 * i : 3 * i + 3] for i in range(count)],
            "pltids": pltids[:count],
        }
    if isinstance(step, StepDskLlgridPl02):
        count = len(step.grid)
        if not -(2**31) <= count <= (268435456 - 32) // 24:
            raise ValueError("Plate count out of range")
        rows = max(1, count)
        flat = [v for row in step.grid for v in row]
        if not all(math.isfinite(v) for v in flat):
            raise ValueError("Invalid grid")
        grid = (D * (2 * rows))(*flat)
        srfpts = (D * (3 * rows))()
        pltids = (I * rows)()
        _llgrid_pl02(*common, count, grid, srfpts, pltids)
        sp.check_for_spice_error(_llgrid_pl02)
        return {
            "srfpts": [srfpts[3 * i : 3 * i + 3] for i in range(count)],
            "pltids": pltids[:count],
        }
    if isinstance(step, StepDskSubptPl02):
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        spoint = (D * 3)()
        alt = D()
        plateID = I()
        _subpt_pl02(
            *common,
            _text(step.method),
            _text(step.target),
            step.et,
            _text(step.abcorr),
            _text(step.obsrvr),
            spoint,
            c.byref(alt),
            c.byref(plateID),
        )
        sp.check_for_spice_error(_subpt_pl02)
        return {"spoint": list(spoint), "alt": alt.value, "plateID": plateID.value}
    if isinstance(step, StepDskSubsolPl02):
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        spoint = (D * 3)()
        dist = D()
        plateID = I()
        _subsol_pl02(
            *common,
            _text(step.method),
            _text(step.target),
            step.et,
            _text(step.abcorr),
            _text(step.obsrvr),
            spoint,
            c.byref(dist),
            c.byref(plateID),
        )
        sp.check_for_spice_error(_subsol_pl02)
        return {"spoint": list(spoint), "dist": dist.value, "plateID": plateID.value}
    if isinstance(step, StepDskTermPl02):
        count = step.npts
        if not -(2**31) <= count <= (268435456 - 32) // 24:
            raise ValueError("Plate count out of range")
        rows = max(1, count)
        if not math.isfinite(step.et):
            raise ValueError("Invalid epoch")
        trgepc = D()
        obspos = (D * 3)()
        trmpts = (D * (3 * rows))()
        pltids = (I * rows)()
        _term_pl02(
            *common,
            _text(step.trmtyp),
            _text(step.source),
            _text(step.target),
            step.et,
            _text(step.fixref),
            _text(step.abcorr),
            _text(step.obsrvr),
            count,
            c.byref(trgepc),
            obspos,
            trmpts,
            pltids,
        )
        sp.check_for_spice_error(_term_pl02)
        return {
            "trgepc": trgepc.value,
            "obspos": list(obspos),
            "trmpts": [trmpts[3 * i : 3 * i + 3] for i in range(count)],
            "pltids": pltids[:count],
        }
    raise ValueError("Unknown legacy plate routine")
