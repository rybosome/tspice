"""Compare surface geometry with the locked SpiceyPy library and lossless cut arrays."""
import ctypes as c

import numpy as np
import spiceypy as sp
from spiceypy.utils import support_types as st
from spiceypy.utils.libspicehelper import libspice

from .models.geometry import StepGeometryLatsrf, StepGeometryLimbpt, StepGeometrySrfnrm, StepGeometryTermpt


def surface_grid(step: StepGeometryLatsrf | StepGeometrySrfnrm) -> list:
    if isinstance(step, StepGeometryLatsrf):
        rows, wrapper, native, width = step.lonlat, sp.latsrf, libspice.latsrf_c, 2
    else:
        rows, wrapper, native, width = step.srfpts, sp.srfnrm, libspice.srfnrm_c, 3
    if rows:
        return wrapper(step.method, step.target, step.et, step.fixref, rows).tolist()
    # SpiceyPy cannot infer the column width of an empty input. The real C call
    # still validates the strings, model, frames and applicable kernel state.
    inputs = st.empty_double_matrix(width, 1)
    output = st.empty_double_matrix(3, 1)
    native(step.method.encode(), step.target.encode(), c.c_double(step.et), step.fixref.encode(), c.c_int(0), inputs, output)
    sp.check_for_spice_error(wrapper)
    return []


def surface_cuts(step: StepGeometryLimbpt | StepGeometryTermpt) -> dict:
    limb = isinstance(step, StepGeometryLimbpt)
    wrapper = sp.limbpt if limb else sp.termpt
    if not -(2**31) <= step.maxn <= 11184810 or not -(2**31) <= step.ncuts < 2**31:
        raise ValueError("Reference surface array outside supported bounds")
    valid = 0 < step.ncuts <= step.maxn
    # Original LIMBPT checks local cut counts only. The 2000-word result
    # cell bounds each cut. Reserve enough initialized physical memory for
    # every write even when a requested logical capacity is too small.
    slots = max(1, step.maxn)
    if limb and valid:
        slots = max(slots, step.ncuts * min(2000, step.maxn))
    if slots > 11184810:
        raise ValueError("Reference surface array exceeds sandbox storage budget")
    counts = st.empty_int_vector(max(1, step.ncuts) if valid else 1)
    points = st.empty_double_matrix(3, slots)
    epochs = st.empty_double_vector(slots)
    vectors = st.empty_double_matrix(3, slots)
    common = [step.target.encode(), c.c_double(step.et), step.fixref.encode(), step.abcorr.encode(),
              step.corloc.encode(), step.observer.encode(), st.to_double_vector(step.refvec),
              c.c_double(step.rolstp), c.c_int(step.ncuts), c.c_double(step.schstp),
              c.c_double(step.soltol), c.c_int(step.maxn), counts, points, epochs, vectors]
    if limb:
        libspice.limbpt_c(step.method.encode(), *common)
    else:
        libspice.termpt_c(step.method.encode(), step.ilusrc.encode(), *common)
    sp.check_for_spice_error(wrapper)
    npts = list(counts)[:step.ncuts]
    total = sum(npts)
    if not all(0 <= n <= 2000 for n in npts) or total > slots or total > step.maxn:
        raise ValueError("Reference cut outputs exceed the declared capacity")
    def doubles(matrix):
        return np.ctypeslib.as_array(matrix)[:total].tolist()
    return {"npts": npts, "points": doubles(points), "epochs": doubles(epochs),
            ("tangts" if limb else "trmvcs"): doubles(vectors)}
