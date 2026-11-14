"""Independent guard for N0067 PXFRM2's uninitialized temporary on an orientation error."""
import ctypes as c

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = c.CDLL(libspice._name)
_ip, _dp = c.POINTER(c.c_int), c.POINTER(c.c_double)
_lib.refchg_.argtypes = [_ip, _ip, _dp, _dp]
_lib.refchg_.restype = c.c_int
for _name in ("chkin_c", "chkout_c"):
    getattr(_lib, _name).argtypes = [c.c_char_p]
    getattr(_lib, _name).restype = None


def checked_pxfrm2(source: str, dest: str, etfrom: float, etto: float):
    if source and dest:
        a, b = sp.namfrm(source), sp.namfrm(dest)
        if a and b:
            if min(a, b) == -2147483648:
                raise ValueError("ID outside N0067 frame hash range")
            _lib.chkin_c(b"pxfrm2_c")
            _lib.chkin_c(b"PXFRM2")
            try:
                for first, second, et in ((a, 1, etfrom), (1, b, etto)):
                    _lib.refchg_(c.byref(c.c_int(first)), c.byref(c.c_int(second)),
                                 c.byref(c.c_double(et)), (c.c_double * 9)())
                    if sp.failed():
                        break
            finally:
                _lib.chkout_c(b"PXFRM2")
                _lib.chkout_c(b"pxfrm2_c")
            sp.check_for_spice_error(sp.pxfrm2)
    return sp.pxfrm2(source, dest, etfrom, etto)
