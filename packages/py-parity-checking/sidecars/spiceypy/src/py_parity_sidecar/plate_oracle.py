"""Independent rectangular mesh marshalling for the pinned CSPICE bindings."""
import ctypes as ct
import math

import numpy as np
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_double = ct.c_double
_int = ct.c_int
_double3 = _double * 3
_int3 = _int * 3
_library = ct.CDLL(libspice._name)
for name in ("pltar_c", "pltvol_c"):
    function = getattr(_library, name)
    function.argtypes = [_int, ct.POINTER(_double3), _int, ct.POINTER(_int3)]
    function.restype = _double
_library.dskrb2_c.argtypes = [_int, ct.POINTER(_double3), _int, ct.POINTER(_int3),
                             _int, ct.POINTER(_double), ct.POINTER(_double), ct.POINTER(_double)]
_library.dskrb2_c.restype = None
_library.nearpt_.argtypes = [ct.POINTER(_double)] * 6
_library.nearpt_.restype = _int


def triangle(values):
    if len(values) != 9:
        raise ValueError("Expected three xyz vertices")
    return np.asarray(values, dtype=np.float64).reshape(3, 3)


def _mesh(vertices, plates):
    if len(vertices) % 3 or len(plates) % 3:
        raise ValueError("Expected complete coordinate and index triples")
    if any(not -(2**31) <= v < 2**31 for v in plates):
        raise ValueError("Unrepresentable index")
    return (np.asarray(vertices, dtype=np.float64).reshape(-1, 3),
            np.asarray(plates, dtype=np.int32).reshape(-1, 3))


def _with_empty_storage(v, p):
    # Preserve the logical row counts while providing valid physical storage.
    vd = v if len(v) else np.zeros((1, 3), dtype=np.float64)
    pd = p if len(p) else np.zeros((1, 3), dtype=np.int32)
    return len(v), vd.ctypes.data_as(ct.POINTER(_double3)), len(p), pd.ctypes.data_as(ct.POINTER(_int3))


def _measure(name, vertices, plates):
    v, p = _mesh(vertices, plates)
    if len(v) and len(p):
        return getattr(sp, name)(v, p)
    result = getattr(_library, name + "_c")(*_with_empty_storage(v, p))
    sp.check_for_spice_error(None)
    return result


def pltar(vertices, plates):
    return _measure("pltar", vertices, plates)


def pltvol(vertices, plates):
    return _measure("pltvol", vertices, plates)


def _check_near_points(v, p, re, flattening):
    # RECGEO fails early on its own parameter errors. Its nested NEARPT
    # failure instead leaves a private normal unreadable by the next RECLAT.
    if not len(v) or re <= 0 or flattening >= 1:
        return
    polar = re - flattening * re
    if not math.isfinite(polar):
        raise ValueError("Unrepresentable reference polar radius")
    a, c = _double(re), _double(polar)
    frames = (b"dskrb2_c", b"DSKRB2", b"RECGEO")
    for frame in frames:
        libspice.chkin_c(frame)
    try:
        def check(point):
            surface, altitude = _double3(), _double()
            _library.nearpt_(_double3(*point), ct.byref(a), ct.byref(a), ct.byref(c),
                             surface, ct.byref(altitude))

        for point in v:
            check(point)
            if sp.failed():
                break
        if not sp.failed():
            for idx in p:
                check(sp.vlcom3(1/3, v[idx[0]-1], 1/3, v[idx[1]-1], 1/3, v[idx[2]-1]))
                if sp.failed():
                    break
    finally:
        for frame in reversed(frames):
            libspice.chkout_c(frame)
    sp.check_for_spice_error(None)


def dskrb2(vertices, plates, corsys, corpar):
    v, p = _mesh(vertices, plates)
    if corsys in (1, 4) and ((p < 1).any() or (p > len(v)).any()):
        raise ValueError("Unrepresentable one-based mesh reference")
    if corsys == 4:
        if len(corpar) < 2:
            raise ValueError("Missing geodetic reference parameters")
        _check_near_points(v, p, *corpar[:2])
    params = np.asarray(corpar or [0.0], dtype=np.float64)
    if len(v) and len(p):
        return sp.dskrb2(v, p, corsys, params)
    lo, hi = _double(), _double()
    _library.dskrb2_c(*_with_empty_storage(v, p), corsys, params.ctypes.data_as(ct.POINTER(_double)),
                      ct.byref(lo), ct.byref(hi))
    sp.check_for_spice_error(None)
    return lo.value, hi.value
