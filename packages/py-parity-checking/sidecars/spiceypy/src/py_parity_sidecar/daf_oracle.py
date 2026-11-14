"""Current-array observations from the library loaded by locked SpiceyPy."""
from __future__ import annotations

import ctypes

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ctypes.CDLL(libspice._name)
if ctypes.sizeof(ctypes.c_int) != 4:
    raise RuntimeError("Unexpected N0067 integer/logical ABI")
_previous = _lib.daffpa_
_previous.argtypes = [ctypes.POINTER(ctypes.c_int)]
_previous.restype = ctypes.c_int
for _trace in (_lib.chkin_c, _lib.chkout_c):
    _trace.argtypes = [ctypes.c_char_p]
    _trace.restype = None
_name = _lib.dafgn_c
_name.argtypes = [ctypes.c_int, ctypes.POINTER(ctypes.c_char)]
_name.restype = None


def previous(handle: int) -> bool:
    sp.dafcs(handle)
    # The public C wrapper copies a private logical even on an early return.
    # DAFFPA advances its cursor; invoke the linked routine exactly once.
    found = ctypes.c_int(0)
    _lib.chkin_c(b"daffpa_c")
    try:
        _previous(ctypes.byref(found))
    finally:
        _lib.chkout_c(b"daffpa_c")
    sp.check_for_spice_error(None)
    return bool(found.value)


def name(handle: int, namlen: int = 1001) -> str:
    if type(namlen) is not int or not -(2**31) <= namlen < 2**31:
        raise ValueError("DAF name capacity must fit a signed 32-bit integer")
    sp.dafcs(handle)
    # A summary fits 125 eight-byte words; the corresponding DAF array name
    # cannot exceed 1000 bytes. CHKOSTR sees the caller's nonpositive lengths.
    capacity = min(namlen, 1001)
    data = ctypes.create_string_buffer(max(1, capacity))
    _name(capacity, data)
    sp.check_for_spice_error(None)
    # SpiceyPy's high-level conversion strips tabs and ignores malformed UTF-8.
    return data.value.decode("utf-8", errors="strict")


def summary(handle: int) -> list[int]:
    sp.dafcs(handle)
    nd, ni = sp.dafhsf(handle)
    size = nd + (ni + 1) // 2
    if not 0 <= nd <= 124 or not 2 <= ni <= 250 or size > 125:
        raise ValueError("Invalid DAF summary layout")
    # SpiceyPy allocates 125 SpiceDoubles and copies the native memory buffer
    # into ndarray storage. Never cast the integer-packed words to Python floats.
    data = sp.dafgs(size)
    if data.itemsize != 8 or data.size != size:
        raise AssertionError("Unexpected DAF summary buffer")
    return list(data.tobytes())
