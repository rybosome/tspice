"""Independent locked N0067 ordering calls, preserving exact C text and IEEE data."""

from __future__ import annotations

import ctypes as ct
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_intp = ct.POINTER(ct.c_int)
_doublep = ct.POINTER(ct.c_double)
_charp = ct.POINTER(ct.c_char)


# Separate CDLL handles avoid changing SpiceyPy's exported ctypes signatures.
def _bind(name, args, result=None):
    fn = getattr(_lib, name + "_c")
    fn.argtypes = args
    fn.restype = result
    return fn


_pred = _bind("isordv", [_intp, ct.c_int], ct.c_int)
_orders = {
    "orderc": _bind("orderc", [ct.c_int, _charp, ct.c_int, _intp]),
    "orderd": _bind("orderd", [_doublep, ct.c_int, _intp]),
    "orderi": _bind("orderi", [_intp, ct.c_int, _intp]),
}
_reorders = {
    "reordc": _bind("reordc", [_intp, ct.c_int, ct.c_int, _charp]),
    "reordd": _bind("reordd", [_intp, ct.c_int, _doublep]),
    "reordi": _bind("reordi", [_intp, ct.c_int, _intp]),
    "reordl": _bind("reordl", [_intp, ct.c_int, _intp]),
}
_shells = {
    "shellc": _bind("shellc", [ct.c_int, ct.c_int, _charp]),
    "shelld": _bind("shelld", [ct.c_int, _doublep]),
    "shelli": _bind("shelli", [ct.c_int, _intp]),
}
_LIMIT = 2**31 - 1


def _integers(values):
    if any(type(v) is not int or not -(2**31) <= v <= _LIMIT for v in values):
        raise ValueError("Expected signed 32-bit integers")


def _buffer(t, values):
    return (t * max(1, len(values)))(*values)


def _rows(values, pad):
    encoded = []
    for value in values:
        if not isinstance(value, str) or "\x00" in value:
            raise ValueError("Expected text without NUL")
        encoded.append(value.encode("utf-8", errors="strict"))
    width = max(2, 1 + max(map(len, encoded), default=0))
    if len(values) * width > _LIMIT:
        raise ValueError("Character table exceeds supported byte count")
    buf = ct.create_string_buffer(max(1, width * len(values)))
    for i, row in enumerate(encoded):
        raw = row.ljust(width - 1, b" ") if pad else row
        ct.memmove(ct.addressof(buf) + width * i, raw, len(raw))
    return width, buf


def run(name, values, order=None):
    """Invoke one toolkit operation. Empty buffers have a non-null physical sentinel."""
    n = len(values)
    if n > _LIMIT // (8 if name.endswith("d") else 4):
        raise ValueError("Array exceeds supported byte count")
    if name == "isordv":
        _integers(values)
        # INT_MAX cannot be a member. Avoid the public wrapper's +1 overflow
        # with the independently equivalent impossible C-style index n.
        input_values = [n if x == _LIMIT else x for x in values]
        result = _pred(_buffer(ct.c_int, input_values), n)
        sp.check_for_spice_error(None)
        return bool(result)
    if name.startswith("reord"):
        _integers(order)
        if len(order) != n:
            raise ValueError("Permutation length differs from data")
        if len(set(order)) != n or any(x < 0 or x >= n for x in order):
            raise ValueError("Invalid zero-based permutation")
        permutation = _buffer(ct.c_int, order)
    c = name.endswith("c")
    if c:
        width, buf = _rows(values, name == "orderc")
    elif name.endswith("d"):
        if any(type(v) not in (int, float) for v in values):
            raise ValueError("Expected doubles")
        buf = _buffer(ct.c_double, values)
    else:
        if name == "reordl":
            if any(type(v) is not bool for v in values):
                raise ValueError("Expected booleans")
        else:
            _integers(values)
        buf = _buffer(ct.c_int, values)
    if name in _orders:
        result = _buffer(ct.c_int, [0] * n)
        if c:
            _orders[name](width, buf, n, result)
        else:
            _orders[name](buf, n, result)
        sp.check_for_spice_error(None)
        return list(result[:n])
    if name in _reorders:
        if c:
            _reorders[name](permutation, n, width, buf)
        else:
            _reorders[name](permutation, n, buf)
    elif c:
        _shells[name](n, width, buf)
    else:
        _shells[name](n, buf)
    sp.check_for_spice_error(None)
    if c:
        returned = buf.raw
        return [
            returned[i * width : (i + 1) * width]
            .split(b"\x00", 1)[0]
            .decode("utf-8", errors="strict")
            for i in range(n)
        ]
    if name == "reordl":
        return [bool(v) for v in buf[:n]]
    return list(buf[:n])
