"""Independent scalar calls to the locked SpiceyPy library, never tspice's shim.

SpiceyPy 6.0.3 has no wrappers for the four variadic min/max routines. Pinned
N0067 SpiceZpr.h declares a fixed SpiceInt count followed by scalar varargs.
The fixed argtypes declaration is essential for Apple's arm64 variadic ABI.
Portable NAIF usage is 0..30 values; pointers, mismatched counts and larger
arities are never sent to C. Every result comes from the actual library call.
"""
from __future__ import annotations

import ctypes
import math
from collections.abc import Sequence

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

if ctypes.sizeof(ctypes.c_int) != 4 or ctypes.sizeof(ctypes.c_double) != 8:
    raise RuntimeError("The pinned CSPICE scalar ABI requires 32-bit int and 64-bit double")

# A separate ctypes handle keeps these prototypes local to this binding while
# loading the exact library chosen by the locked SpiceyPy installation.
_oracle = ctypes.CDLL(libspice._name)
_maxd = _oracle.maxd_c
_maxd.argtypes = [ctypes.c_int]
_maxd.restype = ctypes.c_double
_mind = _oracle.mind_c
_mind.argtypes = [ctypes.c_int]
_mind.restype = ctypes.c_double
_maxi = _oracle.maxi_c
_maxi.argtypes = [ctypes.c_int]
_maxi.restype = ctypes.c_int
_mini = _oracle.mini_c
_mini.argtypes = [ctypes.c_int]
_mini.restype = ctypes.c_int


def _check_count(values: Sequence[float] | Sequence[int]) -> None:
    if len(values) > 30:
        raise ValueError("Portable CSPICE min/max calls permit at most 30 scalar arguments")


def _check_doubles(values: Sequence[float]) -> None:
    _check_count(values)
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in values):
        raise ValueError("CSPICE double inputs must be finite numbers")


def _check_integers(values: Sequence[int]) -> None:
    if any(isinstance(value, bool) or not isinstance(value, int) or not -2147483648 <= value <= 2147483647 for value in values):
        raise ValueError("CSPICE integer inputs must be signed 32-bit integers")


def maxd(values: Sequence[float]) -> float:
    _check_doubles(values)
    result = _maxd(ctypes.c_int(len(values)), *[ctypes.c_double(value) for value in values])
    sp.check_for_spice_error(None)
    return float(result)


def mind(values: Sequence[float]) -> float:
    _check_doubles(values)
    result = _mind(ctypes.c_int(len(values)), *[ctypes.c_double(value) for value in values])
    sp.check_for_spice_error(None)
    return float(result)


def maxi(values: Sequence[int]) -> int:
    _check_count(values)
    _check_integers(values)
    result = _maxi(ctypes.c_int(len(values)), *[ctypes.c_int(value) for value in values])
    sp.check_for_spice_error(None)
    return int(result)


def mini(values: Sequence[int]) -> int:
    _check_count(values)
    _check_integers(values)
    result = _mini(ctypes.c_int(len(values)), *[ctypes.c_int(value) for value in values])
    sp.check_for_spice_error(None)
    return int(result)


def sumai(values: Sequence[int]) -> int:
    _check_integers(values)
    if len(values) > 2147483647:
        raise ValueError("sumai length exceeds signed 32-bit count")
    # Signed C accumulation overflow is undefined, even if a later element
    # would bring the mathematical total back in range. This checks safety
    # only; the returned scientific value is computed by actual sumai_c.
    prefix = 0
    for value in values:
        prefix += value
        if not -2147483648 <= prefix <= 2147483647:
            raise ValueError("sumai ordered prefix exceeds signed 32-bit range")
    return int(sp.sumai(values))
