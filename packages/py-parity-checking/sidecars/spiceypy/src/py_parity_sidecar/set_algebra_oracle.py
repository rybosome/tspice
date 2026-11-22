"""Caller-owned result cells for the independently installed N0067 library."""

import ctypes as ct
import math

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceCell


# sp.diff/inter/sdiff/union allocate new output cells. Bind just these four
# actual public symbols to retain the caller's capacity, width and set flag.
_library = ct.CDLL(libspice._name)
_writers = {}
for _name in ("diff", "inter", "sdiff", "union"):
    _routine = getattr(_library, _name + "_c")
    _routine.argtypes = [ct.POINTER(SpiceCell)] * 3
    _routine.restype = None
    _writers["cells-windows." + _name] = _routine


def check_inputs(a: SpiceCell, b: SpiceCell) -> None:
    if a.dtype != b.dtype or not a.isSet or not b.isSet:
        return
    for cell in (a, b):
        if cell.dtype == 1 and cell.init:
            # The translated numeric routines use the control cardinality,
            # which can differ from the C descriptor after SETEXCESS.
            base = ct.cast(cell.base, ct.POINTER(ct.c_double))
            card = base[5]
            if not (card.is_integer() and 0 <= card <= cell.size):
                raise ValueError("Invalid double set control cardinality")
            if any(math.isnan(base[6 + i]) for i in range(int(card))):
                raise ValueError("Unordered double set member")


def write_result(op: str, a: SpiceCell, b: SpiceCell, result: SpiceCell) -> None:
    if ct.addressof(result) in (ct.addressof(a), ct.addressof(b)):
        raise ValueError("Result must have separate storage")
    check_inputs(a, b)
    _writers[op](ct.byref(a), ct.byref(b), ct.byref(result))
    sp.check_for_spice_error(None)
