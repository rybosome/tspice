"""Observe N0067 Euler matrices on the independently loaded SpiceyPy toolkit."""

import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice


def traced_eul2m(angles: tuple[float, float, float], axes: tuple[int, int, int]) -> list[list[float]]:
    """Safe equivalent of eul2m_c: never access a matrix after an error."""
    if any(not -(2**31) <= axis < 2**31 for axis in axes):
        raise ValueError("Axis must fit a SpiceInt")
    lib = ct.CDLL(libspice._name)
    if ct.sizeof(ct.c_int) != 4 or ct.sizeof(ct.c_double) != 8:
        raise RuntimeError("Unexpected pinned SPICELIB ABI")
    lib.eul2m_.argtypes = [ct.POINTER(ct.c_double)] * 3 + [ct.POINTER(ct.c_int)] * 3 + [ct.POINTER(ct.c_double)]
    lib.eul2m_.restype = ct.c_int
    lib.chkin_c.argtypes = lib.chkout_c.argtypes = [ct.c_char_p]
    lib.chkin_c.restype = lib.chkout_c.restype = None
    inputs = [ct.c_double(x) for x in angles] + [ct.c_int(i) for i in axes]
    output = (ct.c_double * 9)()
    lib.chkin_c(b"eul2m_c")
    try:
        lib.eul2m_(*(ct.byref(x) for x in inputs), output)
    finally:
        lib.chkout_c(b"eul2m_c")
    sp.check_for_spice_error(None)
    return [[output[3 * col + row] for col in range(3)] for row in range(3)]


def eul2m(angles: tuple[float, float, float], axes: tuple[int, int, int]) -> list[list[float]]:
    # N0067 eul2m_c always transposes its private matrix. On a known error
    # path that matrix is uninitialized. Use the typed inner route only then.
    if not sp.failed() and all(1 <= i <= 3 for i in axes):
        return sp.eul2m(*angles, *axes).tolist()
    return traced_eul2m(angles, axes)
