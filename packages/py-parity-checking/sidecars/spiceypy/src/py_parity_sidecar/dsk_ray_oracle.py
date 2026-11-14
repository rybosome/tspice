"""Independent N0067 ray calls with initialized DSKXSI miss/error outputs."""
import ctypes as c
from pathlib import Path

import numpy as np
import spiceypy as sp
from spiceypy.utils import support_types as st
from spiceypy.utils.libspicehelper import libspice

from .models.dsk import StepDskDskxsi, StepDskDskxv


Integer, Double = c.c_int, c.c_double
IntPointer, DoublePointer = c.POINTER(Integer), c.POINTER(Double)
Vector3 = Double * 3

# SpiceZfc.h declares two trailing ftnlen values and 32-bit logical/integer.
dskxsi_inner = libspice.dskxsi_
dskxsi_inner.argtypes = [
    IntPointer, c.c_char_p, IntPointer, IntPointer, DoublePointer, c.c_char_p,
    DoublePointer, DoublePointer, IntPointer, IntPointer, DoublePointer,
    IntPointer, IntPointer, DoublePointer, DoublePointer, IntPointer,
    IntPointer, Integer, Integer,
]
dskxsi_inner.restype = Integer


def source_intercept(step: StepDskDskxsi) -> dict:
    target, frame = step.target.encode(), step.fixref.encode()
    priority, epoch = Integer(step.pri), Double(step.et)
    count = Integer(len(step.srflst))
    surface_ids = (Integer * max(1, count.value))(*step.srflst)
    vertex, direction = Vector3(*step.vertex), Vector3(*step.raydir)
    point, handle, found = Vector3(), Integer(), Integer()

    if not target or not frame:
        # CHKFSTR returns before dskxsi_c touches either descriptor.
        libspice.dskxsi_c(
            priority, target, count, surface_ids, epoch, frame, vertex, direction,
            Integer(step.maxd), Integer(step.maxi), point, c.byref(handle),
            c.byref(st.SpiceDLADescr()), c.byref(st.SpiceDSKDescr()),
            c.byref(Double()), c.byref(Integer()), c.byref(found),
        )
        sp.check_for_spice_error(sp.dskxsi)
        raise AssertionError("Expected C empty string diagnostic")

    max_doubles, max_ints = Integer(min(1, step.maxd)), Integer(min(1, step.maxi))
    dla, dsk = (Integer * 8)(), (Double * 24)()
    double_component, integer_component = Double(), Integer()
    libspice.chkin_c(b"dskxsi_c")
    dskxsi_inner(
        c.byref(priority), target, c.byref(count), surface_ids, c.byref(epoch),
        frame, vertex, direction, c.byref(max_doubles), c.byref(max_ints),
        point, c.byref(handle), dla, dsk, c.byref(double_component),
        c.byref(integer_component), c.byref(found), len(target), len(frame),
    )
    libspice.chkout_c(b"dskxsi_c")
    sp.check_for_spice_error(sp.dskxsi)
    if not found.value:
        return {"found": False}

    # A hit defines every descriptor word. The actual public wrapper is now
    # independently safe and supplies a second check on the raw ABI layout.
    point2, handle2, dla2, dsk2, _, ic2 = sp.dskxsi(
        step.pri, step.target, step.srflst, step.et, step.fixref, step.vertex, step.raydir
    )
    dla_fields = ["bwdptr", "fwdptr", "ibase", "isize", "dbase", "dsize", "cbase", "csize"]
    integer_fields = ["surfce", "center", "dclass", "dtype", "frmcde", "corsys"]
    bounds = ["co1min", "co1max", "co2min", "co2max", "co3min", "co3max", "start", "stop"]
    dla_values = {name: int(getattr(dla2, name)) for name in dla_fields}
    dsk_values = {name: int(getattr(dsk2, name)) for name in integer_fields}
    dsk_values["corpar"] = list(dsk2.corpar)
    dsk_values.update({name: float(getattr(dsk2, name)) for name in bounds})
    expected_descriptor = [
        *(dsk_values[name] for name in integer_fields),
        *dsk2.corpar,
        *(dsk_values[name] for name in bounds),
    ]
    if (
        list(point) != list(point2)
        or handle.value != handle2
        or list(dla) != list(dla_values.values())
        or list(dsk) != expected_descriptor
        or [integer_component.value] != list(ic2)
    ):
        raise AssertionError("Public DSKXSI output disagrees with locked linked source")

    for index in range(sp.ktotal("DSK")):
        file, _, _, loaded_handle = sp.kdata(index, "DSK")
        if loaded_handle == handle.value:
            return {
                "found": True, "sourceFile": Path(file).name, "dladsc": dla_values,
                "dskdsc": dsk_values, "xpt": list(point), "dc": [],
                "ic": [integer_component.value],
            }
    raise AssertionError("No matching KEEPER DSK source")


def batch_intercepts(step: StepDskDskxv) -> list:
    if len(step.vertices) != len(step.dirs):
        raise ValueError("DSK oracle ray counts differ")
    if not step.vertices:
        # The Python matrix converter cannot infer a three-column empty matrix.
        # C checks nrays before allocation or access; supply a 1x3 sentinel.
        dummy = st.to_double_matrix(np.zeros((1, 3)))
        ids = (Integer * max(1, len(step.srflst)))(*step.srflst)
        libspice.dskxv_c(
            Integer(step.pri), step.target.encode(), Integer(len(step.srflst)), ids,
            Double(step.et), step.fixref.encode(), Integer(0), dummy, dummy, dummy,
            c.byref(Integer()),
        )
        sp.check_for_spice_error(sp.dskxv)
        raise AssertionError("Expected zero-count DSKXV diagnostic")
    points, flags = sp.dskxv(
        step.pri, step.target, step.srflst, step.et, step.fixref, step.vertices, step.dirs
    )
    return [
        {"found": True, "xpt": row.tolist()} if flag else {"found": False}
        for row, flag in zip(points, flags, strict=True)
    ]
