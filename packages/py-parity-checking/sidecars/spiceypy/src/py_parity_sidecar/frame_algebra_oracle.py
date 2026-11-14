"""Checked external N0067 frame operations using SpiceyPy's own library."""
from __future__ import annotations

import ctypes

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

# On failure TWOVXF attempts to invert its private intermediate matrix.
# The underlying constructor publishes the same diagnostic before inversion.
_library = ctypes.CDLL(libspice._name)
_construct = _library.zztwovxf_
_doubles = ctypes.POINTER(ctypes.c_double)
_integer = ctypes.c_int
_intptr = ctypes.POINTER(_integer)
_construct.argtypes = [_doubles, _intptr, _doubles, _intptr, _doubles]
_construct.restype = ctypes.c_int


def twovxf(axis, indexa: int, plane, indexp: int):
    state = ctypes.c_double * 6
    intermediate = (ctypes.c_double * 36)()
    a, p = _integer(indexa), _integer(indexp)
    libspice.chkin_c(b"twovxf_c")
    libspice.chkin_c(b"TWOVXF")
    try:
        _construct(state(*axis), ctypes.byref(a), state(*plane), ctypes.byref(p), intermediate)
    finally:
        libspice.chkout_c(b"TWOVXF")
        libspice.chkout_c(b"twovxf_c")
    sp.check_for_spice_error(None)
    return sp.twovxf(axis, indexa, plane, indexp)


_angles = _library.eul2m_
_angles.argtypes = [_doubles, _doubles, _doubles, _intptr, _intptr, _intptr, _doubles]
_angles.restype = ctypes.c_int
_inverse = _library.xf2eul_
_inverse.argtypes = [_doubles, _intptr, _intptr, _intptr, _doubles, _intptr]
_inverse.restype = ctypes.c_int


def xf2eul(xform, axisa: int, axisb: int, axisc: int):
    # The translated inverse returns before setting uniqueness on an M2EUL
    # error. Supply initialized storage and column-major input to that entry.
    matrix = (ctypes.c_double * 36)(*(xform[i][j] for j in range(6) for i in range(6)))
    angles = (ctypes.c_double * 6)()
    unique = _integer()
    axes = [_integer(v) for v in (axisa, axisb, axisc)]
    libspice.chkin_c(b"xf2eul_c")
    try:
        _inverse(matrix, *(ctypes.byref(v) for v in axes), angles, ctypes.byref(unique))
    finally:
        libspice.chkout_c(b"xf2eul_c")
    sp.check_for_spice_error(None)
    return sp.xf2eul(xform, axisa, axisb, axisc)


def eul2xf(eulang, axisa: int, axisb: int, axisc: int):
    if axisa not in (1, 2, 3) and axisb in (axisa, axisc):
        # This invalid triple reaches a Fortran axis lookup before the usual
        # EUL2M check. Run that check using its initialized numerical ABI.
        angles = [ctypes.c_double(v) for v in eulang[:3]]
        axes = [_integer(v) for v in (axisa, axisb, axisc)]
        rotation = (ctypes.c_double * 9)()
        libspice.chkin_c(b"eul2xf_c")
        libspice.chkin_c(b"EUL2XF")
        try:
            _angles(*(ctypes.byref(v) for v in angles + axes), rotation)
        finally:
            libspice.chkout_c(b"EUL2XF")
            libspice.chkout_c(b"eul2xf_c")
        sp.check_for_spice_error(None)
        raise RuntimeError("EUL2M accepted an invalid first rotation axis")
    return sp.eul2xf(eulang, axisa, axisb, axisc)
