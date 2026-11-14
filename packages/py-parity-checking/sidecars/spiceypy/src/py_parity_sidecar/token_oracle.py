"""Canonical N0067 text results with caller-selected capacities and byte positions."""
from __future__ import annotations

import ctypes

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

from .string_oracle import _signed32, _text_bytes, single_byte

# These typed handles belong only to the external library brought in by locked
# SpiceyPy. NEXTWD/NTHWD have no 6.0.3 convenience wrapper. LPARSE fixes its
# own row width, and both list wrappers strip terminal whitespace during decode.
_library = ctypes.CDLL(libspice._name)
_int = ctypes.c_int
_src = ctypes.c_char_p
_out = ctypes.POINTER(ctypes.c_char)
_int_out = ctypes.POINTER(_int)
_nextwd = _library.nextwd_c
_nextwd.argtypes = [_src, _int, _int, _out, _out]
_nextwd.restype = None
_nthwd = _library.nthwd_c
_nthwd.argtypes = [_src, _int, _int, _out, _int_out]
_nthwd.restype = None
_lparse, _lparsm = _library.lparse_c, _library.lparsm_c
for _fn in (_lparse, _lparsm):
    _fn.argtypes = [_src, _src, _int, _int, _int_out, ctypes.c_void_p]
    _fn.restype = None


_lx4uns = _library.lx4uns_c
_lx4uns.argtypes = [_src, _int, _int_out, _int_out]
_lx4uns.restype = None


def _token_bytes(text: str) -> bytes:
    data = _text_bytes(text)
    # Translated lexical routines use one-based cursors and a lookahead byte.
    if len(data) > 2147483645:
        raise ValueError("Token input must leave room for signed 32-bit lookahead")
    return data


def _capacity(data: bytes, requested: int | None) -> int:
    sufficient = max(2, len(data) + 1)
    return sufficient if requested is None else min(_signed32(requested), sufficient)


def next_word(text: str, nexlen: int | None, reslen: int | None) -> dict[str, str]:
    data = _token_bytes(text)
    cap1, cap2 = _capacity(data, nexlen), _capacity(data, reslen)
    first = ctypes.create_string_buffer(max(1, cap1))
    rest = ctypes.create_string_buffer(max(1, cap2))
    _nextwd(data, cap1, cap2, first, rest)
    sp.check_for_spice_error(None)
    return {"next": first.value.decode("utf-8"), "rest": rest.value.decode("utf-8")}


def nth_word(text: str, nth: int, worlen: int | None) -> dict[str, str | int]:
    data = _token_bytes(text)
    cap = _capacity(data, worlen)
    storage = ctypes.create_string_buffer(max(1, cap))
    loc = _int()
    # At most one word can begin at each input byte. Every later word
    # is absent with the same public location, including the highest SpiceInt.
    safe_nth = min(_signed32(nth), len(data))
    _nthwd(data, safe_nth, cap, storage, ctypes.byref(loc))
    sp.check_for_spice_error(None)
    return {"word": storage.value.decode("utf-8"), "loc": loc.value}


def parse_items(text: str, delimiters: str, nmax: int, itemln: int | None, *, multiple: bool):
    data, delim = _token_bytes(text), _text_bytes(delimiters)
    # A sequence of n delimiter bytes can bound at most n+1 items.
    count = min(_signed32(nmax), len(data) + 1)
    width = _capacity(data, itemln)
    # Invalid item widths cannot write rows. Give CSPICE valid storage so its
    # own size/count checks determine the result in their canonical order.
    size = count * width if count > 0 and width >= 2 else 1
    if size > 256 * 1024 * 1024:
        raise ValueError("Token output exceeds the bounded oracle workspace")
    storage = ctypes.create_string_buffer(size)
    n = _int()
    function = _lparsm if multiple else _lparse
    function(data, delim, count, width, ctypes.byref(n), storage)
    sp.check_for_spice_error(None)
    if not 0 <= n.value <= max(0, count):
        raise ValueError("Invalid token count returned by CSPICE")
    items = []
    for row in range(n.value):
        block = storage[row * width:(row + 1) * width]
        end = block.index(b"\x00")
        items.append(block[:end].decode("utf-8"))
    return {"n": n.value, "items": items}


def scan(name: str, text: str, first: int, quote: str | None = None) -> dict[str, int]:
    data = _token_bytes(text)
    first = _signed32(first)
    # Both integer endpoints have an overflowing intermediate in N0067's
    # one-based indexing. Compare the representable out-of-range sentinel
    # at an equivalent safe index, then restore the caller's byte position.
    safe_first = max(-1, min(first, len(data)))
    if not data and name == "lx4uns":
        # The N0067 empty branch leaves both output arguments untouched.
        # Supply the documented miss and independently verify the call
        # preserves it. SpiceyPy's wrapper initializes its outputs to zero.
        end, count = _int(safe_first - 1), _int(0)
        _lx4uns(data, safe_first, ctypes.byref(end), ctypes.byref(count))
        sp.check_for_spice_error(None)
        last, nchar = end.value, count.value
    elif name == "lxqstr":
        if quote is None:
            raise ValueError("A quote character is required")
        single_byte(quote)
        last, nchar = sp.lxqstr(text, quote, safe_first)
    else:
        fn = {"lx4dec": sp.lx4dec, "lx4num": sp.lx4num,
              "lx4sgn": sp.lx4sgn, "lx4uns": sp.lx4uns}[name]
        last, nchar = fn(text, safe_first)
    if safe_first != first and (data or name in ("lx4uns", "lxqstr")):
        if nchar != 0 or last != safe_first - 1:
            raise ValueError("Locked lexer did not return its documented miss")
        last = first - 1
    return {"last": last, "nchar": nchar}
