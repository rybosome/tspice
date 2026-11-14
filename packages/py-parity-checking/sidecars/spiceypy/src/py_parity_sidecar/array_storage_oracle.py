"""Call the six canonical storage routines missing from locked SpiceyPy 6.0.3.

Each call receives real, writable, correctly aligned memory initialized from
the workflow. Guard bytes surround storage, including a non-null dummy element
at dimension zero. Check unaffected bytes even on the toolkit's failure path.
"""
from __future__ import annotations

import ctypes as ct
from collections.abc import Sequence

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_i = ct.c_int
_d = ct.c_double
_byte = ct.c_ubyte
_lib = ct.CDLL(libspice._name)
if ct.sizeof(_i) != 4 or ct.sizeof(_d) != 8:
    raise RuntimeError("The pinned oracle requires 32-bit SpiceInt and 64-bit SpiceDouble")


def _symbol(name, *arguments):
    function = getattr(_lib, name)
    function.argtypes = list(arguments)
    function.restype = None
    return function


_clearc = _symbol("clearc_c", _i, _i, ct.c_void_p)
_cleard = _symbol("cleard_c", _i, ct.POINTER(_d))
_cleari = _symbol("cleari_c", _i, ct.POINTER(_i))
_filld = _symbol("filld_c", _d, _i, ct.POINTER(_d))
_filli = _symbol("filli_c", _i, _i, ct.POINTER(_i))
_moved = _symbol("moved_c", ct.POINTER(_d), _i, ct.POINTER(_d))


def _int32(value: int) -> int:
    if type(value) is not int or not -2147483648 <= value <= 2147483647:
        raise ValueError("Expected a signed 32-bit integer")
    return value


def _extent(count: int, *arrays: Sequence) -> None:
    _int32(count)
    for array in arrays:
        if len(array) > 2147483647 or count > len(array):
            raise ValueError("Insufficient or unrepresentable storage")


class _Guarded:
    def __init__(self, ctype, values):
        self.width = ct.sizeof(ctype)
        self.length = len(values)
        # The unused middle element for empty storage is also a canary.
        self.array = (ctype * (max(1, len(values)) + 2))()
        ct.memset(ct.addressof(self.array), 0x65, ct.sizeof(self.array))
        for index, value in enumerate(values, start=1):
            if ctype is _i:
                _int32(value)
            elif ctype is _byte and (type(value) is not int or not 0 <= value <= 255):
                raise ValueError("Expected a byte")
            elif ctype is _d and type(value) not in (float, int):
                raise ValueError("Expected a double")
            self.array[index] = value
        self.pointer = ct.cast(ct.byref(self.array, self.width), ct.POINTER(ctype))
        self.before = bytes(self.array)

    def check(self, writable: int) -> None:
        after = bytes(self.array)
        end = self.width * (1 + writable)
        if after[:self.width] != self.before[:self.width] or after[end:] != self.before[end:]:
            raise AssertionError("CSPICE changed storage outside its writable prefix")

    def values(self):
        return list(self.array[1:1 + self.length])


def clearc(ndim: int, arrlen: int, data: list[int]) -> list[int]:
    _int32(ndim)
    _int32(arrlen)
    # For positive ndim, CSPICE checks width >= 2 before indexing rows. A
    # nonpositive ndim returns before checking width. Size only a real write.
    writable = ndim * arrlen if ndim > 0 and arrlen >= 2 else 0
    _extent(writable, data)
    storage = _Guarded(_byte, data)
    try:
        _clearc(ndim, arrlen, storage.pointer)
        sp.check_for_spice_error(None)
    finally:
        storage.check(writable)
    return storage.values()


def _numeric(function, ctype, ndim, data, *leading):
    _extent(ndim, data)
    storage = _Guarded(ctype, data)
    try:
        function(*leading, ndim, storage.pointer)
        sp.check_for_spice_error(None)
    finally:
        storage.check(max(0, ndim))
    return storage.values()


def cleard(ndim: int, data: list[float]) -> list[float]:
    return _numeric(_cleard, _d, ndim, data)


def cleari(ndim: int, data: list[int]) -> list[int]:
    return _numeric(_cleari, _i, ndim, data)


def filld(value: float, ndim: int, data: list[float]) -> list[float]:
    if type(value) not in (float, int):
        raise ValueError("Expected a double")
    return _numeric(_filld, _d, ndim, data, value)


def filli(value: int, ndim: int, data: list[int]) -> list[int]:
    return _numeric(_filli, _i, ndim, data, _int32(value))


def moved(source: list[float], ndim: int, destination: list[float]) -> list[float]:
    # In pinned SpiceZmc.h MOVED passes sizeof(double)*ndim to memmove.
    # Negative ndim converts to a huge size_t, despite the no-op header prose.
    if _int32(ndim) < 0:
        raise ValueError("Negative moved count is unsafe in pinned CSPICE")
    _extent(ndim, source, destination)
    src = _Guarded(_d, source)
    dest = _Guarded(_d, destination)
    try:
        _moved(src.pointer, ndim, dest.pointer)
        sp.check_for_spice_error(None)
    finally:
        src.check(0)
        dest.check(ndim)
    return dest.values()
