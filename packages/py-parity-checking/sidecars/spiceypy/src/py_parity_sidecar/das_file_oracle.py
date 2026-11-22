"""N0067 DAS text outputs, with independent lengths and exact UTF-8 decoding."""
import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_char = ct.POINTER(ct.c_char)
_int = ct.POINTER(ct.c_int)
_name = _lib.dashfn_c
_name.argtypes = [ct.c_int, ct.c_int, _char]
_name.restype = None
_record = _lib.dasrfr_c
_record.argtypes = [ct.c_int, ct.c_int, ct.c_int, _char, _char, _int, _int, _int, _int]
_record.restype = None


def _capacity(n: int, limit: int) -> int:
    if not -(2**31) <= n <= 2**31 - 1:
        raise ValueError("DAS output length exceeds SpiceInt")
    return min(n, limit)


def file_name(handle: int, namlen: int) -> str:
    n = _capacity(namlen, 256)
    buffer = ct.create_string_buffer(max(1, n))
    _name(handle, n, buffer)
    sp.check_for_spice_error(None)
    return buffer.value.decode("utf-8")


def file_record(handle: int, idwlen: int, ifnlen: int):
    # SpiceyPy 6.0.3 couples both output widths and strips trailing whitespace beyond CSPICE blank padding.
    a, b = _capacity(idwlen, 9), _capacity(ifnlen, 61)
    identifier, internal = ct.create_string_buffer(max(1, a)), ct.create_string_buffer(max(1, b))
    counts = [ct.c_int() for _ in range(4)]
    _record(handle, a, b, identifier, internal, *(ct.byref(x) for x in counts))
    sp.check_for_spice_error(None)
    return dict(idword=identifier.value.decode("utf-8"), ifname=internal.value.decode("utf-8"),
                **dict(zip(("nresvr", "nresvc", "ncomr", "ncomc"), (v.value for v in counts))))
