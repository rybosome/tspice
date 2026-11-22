"""Canonical caller-owned result cells in the locked SpiceyPy library."""

from __future__ import annotations

import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceCell

# These four Python wrappers choose and allocate their own output capacity.
# Bind the same independent library with a separate ctypes function table to
# preserve the workflow's explicit result cell, its capacity and its lifetime.
_lib = ct.CDLL(libspice._name)
_cell = ct.POINTER(SpiceCell)
_lib.wncomd_c.argtypes = [ct.c_double, ct.c_double, _cell, _cell]
_lib.wncomd_c.restype = None
for _name in ("wndifd_c", "wnintd_c", "wnunid_c"):
    _fn = getattr(_lib, _name)
    _fn.argtypes = [_cell, _cell, _cell]
    _fn.restype = None
_lib.wnextd_c.argtypes = [ct.c_char, _cell]
_lib.wnextd_c.restype = None


class OracleWindow(SpiceCell):
    """The logical endpoint capacity that the sidecar originally allocated."""

    endpoint_capacity: int


def allocate_window(max_intervals: int) -> OracleWindow:
    if not 0 <= max_intervals <= (2**31 - 1) // 2:
        raise ValueError("Window endpoint capacity must fit a signed SpiceInt")
    capacity = 2 * max_intervals
    # WNUNID initializes a cursor from its first storage slot even when the
    # input is empty. Keep a real backing pair at logical capacity zero.
    window = OracleWindow.double(max(2, capacity))
    window.endpoint_capacity = capacity
    if capacity == 0:
        sp.ssize(0, window)
    return window


def check_resize(window: OracleWindow, size: int) -> None:
    if not 0 <= size <= window.endpoint_capacity:
        raise ValueError("Logical size exceeds the allocated window storage")


_MAX_ENDPOINT_INDEX = 2**31 - 1 - SpiceCell.CTRLBLOCK


def validate_input(window: SpiceCell) -> None:
    card = sp.card(window)
    if card > _MAX_ENDPOINT_INDEX:
        raise ValueError("Window plus its control area exceeds signed endpoint indices")
    if card % 2:
        raise ValueError("Input window needs complete endpoint pairs")
    previous_right = None
    for i in range(sp.wncard(window)):
        left, right = sp.wnfetd(window, i)
        if not left <= right or (previous_right is not None and not previous_right < left):
            raise ValueError("Expected ordered disjoint intervals")
        previous_right = right


def _distinct_result(result: SpiceCell, *inputs: SpiceCell) -> None:
    for window in inputs:
        validate_input(window)
    if sum(sp.wncard(window) * 2 for window in inputs) > 2**31 - 1:
        raise ValueError("Combined endpoint count exceeds signed integer range")
    if sp.size(result) > _MAX_ENDPOINT_INDEX:
        raise ValueError("Result plus its control area exceeds signed endpoint indices")
    if sp.size(result) % 2:
        raise ValueError("Result capacity must admit complete endpoint pairs")
    if any(result.base == window.base for window in inputs):
        raise ValueError("Result window must be distinct from each input")


def wncomd(left: float, right: float, window: SpiceCell, result: SpiceCell) -> None:
    _distinct_result(result, window)
    _lib.wncomd_c(left, right, ct.byref(window), ct.byref(result))
    sp.check_for_spice_error(None)


def wndifd(a: SpiceCell, b: SpiceCell, result: SpiceCell) -> None:
    _distinct_result(result, a, b)
    _lib.wndifd_c(ct.byref(a), ct.byref(b), ct.byref(result))
    sp.check_for_spice_error(None)


def wnintd(a: SpiceCell, b: SpiceCell, result: SpiceCell) -> None:
    _distinct_result(result, a, b)
    _lib.wnintd_c(ct.byref(a), ct.byref(b), ct.byref(result))
    sp.check_for_spice_error(None)


def wnunid(a: SpiceCell, b: SpiceCell, result: SpiceCell) -> None:
    _distinct_result(result, a, b)
    _lib.wnunid_c(ct.byref(a), ct.byref(b), ct.byref(result))
    sp.check_for_spice_error(None)


def wnextd(side: str, window: SpiceCell) -> None:
    if side in ("L", "R"):
        sp.wnextd(side, window)
        return
    # SpiceyPy asserts uppercase L/R. CSPICE accepts lowercase as well and
    # reports INVALIDENDPNTSPEC for an unrecognized single byte.
    encoded = side.encode("ascii")
    if len(encoded) != 1:
        raise ValueError("Expected one ASCII endpoint selector")
    _lib.wnextd_c(encoded, ct.byref(window))
    sp.check_for_spice_error(None)
