"""Observe complete name/fallback text and flag on the independent locked library."""
from __future__ import annotations
import ctypes
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_library = ctypes.CDLL(libspice._name)
_char_out = ctypes.POINTER(ctypes.c_char)
_flag = ctypes.POINTER(ctypes.c_int)
_c2s, _css = _library.srfc2s_c, _library.srfcss_c
_c2s.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int, _char_out, _flag]
_css.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, _char_out, _flag]
_c2s.restype = _css.restype = None


_INT_MIN = -(2**31)


def _guard_surface_hash(code: int | None = None) -> None:
    # Both ZZSRFC2N (query) and ZZSRFINI (table initialization for either
    # translation direction) use ZZHASHI. Its signed abs cannot accept INT_MIN.
    if code == _INT_MIN:
        raise ValueError("Surface ID outside safe N0067 surface hash range")
    with sp.no_found_check():
        count, kind, found = sp.dtpool("NAIF_SURFACE_CODE")
        if not found or kind != "N" or count == 0 or count > 2000:
            # ZZSRFKER checks the table metadata and 2000-row limit first.
            return
        values, found = sp.gdpool("NAIF_SURFACE_CODE", 0, count)
    if not found or len(values) != count:
        raise ValueError("Surface code table changed during oracle call")
    # GIPOOL diagnoses values outside the signed range before conversion.
    # In-range negative numbers round to nearest with ties away from zero.
    if any(_INT_MIN <= value <= _INT_MIN + 0.5 for value in values):
        raise ValueError("NAIF_SURFACE_CODE contains an ID outside the safe N0067 surface hash range")


def _c_string(text: str) -> bytes:
    data = text.encode("utf-8", "strict")
    if b"\0" in data or len(data) >= 2**31 - 1:
        raise ValueError("Invalid surface translation C string")
    return data


def _body_code(body: int) -> int:
    if type(body) is not int or not _INT_MIN <= body < 2**31:
        raise ValueError("Body code outside signed32")
    return body


def surface_code(surface: str, body: int | str) -> tuple[int, bool]:
    _c_string(surface)
    if isinstance(body, str):
        _c_string(body)
    else:
        _body_code(body)
    _guard_surface_hash()
    with sp.no_found_check():
        code, found = sp.srfs2c(surface, body) if isinstance(body, str) else sp.srfscc(surface, body)
    return int(code), bool(found)


def exact_surface_text(code: int, body: int | str, capacity: int) -> tuple[str, bool]:
    if type(code) is not int or not -(2**31) <= code < 2**31:
        raise ValueError("Surface code outside signed32")
    if type(capacity) is not int or not -(2**31) <= capacity < 2**31:
        raise ValueError("Surface capacity outside signed32")
    # SpiceSrf.h SPICE_SRF_SFNMLN; even too-small capacities have a real pointer.
    n = min(capacity, 37)
    physical = max(n, 1)
    buf = (ctypes.c_ubyte * (physical + 2))(*([0xA5] * (physical + 2)))
    result = ctypes.cast(ctypes.byref(buf, 1), _char_out)
    named = ctypes.c_int(-1)
    _guard_surface_hash(code)
    if isinstance(body, str):
        _css(code, _c_string(body), n, result, ctypes.byref(named))
    else:
        _c2s(code, _body_code(body), n, result, ctypes.byref(named))
    if buf[0] != 0xA5 or buf[-1] != 0xA5:
        raise AssertionError("Canonical surface output exceeded declared storage")
    sp.check_for_spice_error(None)
    interior = bytes(buf[1:-1])
    end = interior.index(b"\0")
    if named.value not in (0, 1):
        raise AssertionError("Noncanonical surface name flag")
    return interior[:end].decode("utf-8", "strict"), bool(named.value)
