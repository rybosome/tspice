"""Observe native-order DAF words from the N0067 library installed by SpiceyPy."""
from __future__ import annotations

import ctypes as ct
import math

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_i, _d = ct.c_int, ct.c_double
_ip, _dp = ct.POINTER(_i), ct.POINTER(_d)
if ct.sizeof(_i) != 4 or ct.sizeof(_d) != 8:
    raise RuntimeError("Unexpected N0067 DAF word sizes")
_pack = _lib.dafps_c
_pack.argtypes = [_i, _i, _dp, _ip, _dp]
_unpack = _lib.dafus_c
_unpack.argtypes = [_dp, _i, _i, _dp, _ip]
_record = _lib.dafgsr_c
_record.argtypes = [_i, _i, _i, _i, _dp, _ip]
_header = _lib.dafrfr_c
_header.argtypes = [_i, _i, _ip, _ip, ct.POINTER(ct.c_char), _ip, _ip, _ip]
_physical = _lib.dafrda_c
_logical = _lib.dafgda_c
for _read in (_physical, _logical):
    _read.argtypes = [_i, _i, _i, _dp]
for _fn in (_pack, _unpack, _record, _header, _physical, _logical):
    _fn.restype = None


def _layout(nd: int, ni: int) -> tuple[int, int, int]:
    n = min(125, max(0, nd))
    m = min(250 - 2 * n, max(0, ni))
    return n, m, 8 * (n + (m + 1) // 2)


def pack(nd: int, ni: int, dc: list[float], ic: list[int]) -> list[int]:
    n, m, length = _layout(nd, ni)
    if len(dc) < n or len(ic) < m:
        raise ValueError("DAFPS input shorter than effective component count")
    doubles = (_d * max(n, 1))(*dc[:n])
    integers = (_i * max(m, 1))(*ic[:m])
    # The translated pack and unpack entries visit one extra scratch word
    # even when there are no integer components. This also covers n == 125.
    packed = (_d * 126)()
    _pack(nd, ni, doubles, integers, packed)
    sp.check_for_spice_error(None)
    result = bytearray(ct.string_at(packed, length))
    if m % 2:
        # Only the first m integers belong to this summary. The other half
        # of its final word has no CSPICE value and depends on call history.
        result[-4:] = bytes(4)
    return list(result)


def unpack(summary: list[int], nd: int, ni: int):
    n, m, length = _layout(nd, ni)
    if len(summary) < length:
        raise ValueError("DAFUS input shorter than effective summary")
    packed = (_d * 126)()
    ct.memmove(packed, bytes(summary[:length]), length)
    dc, ic = (_d * max(n, 1))(), (_i * max(m, 1))()
    _unpack(packed, nd, ni, dc, ic)
    sp.check_for_spice_error(None)
    return {"dc": list(dc[:n]), "ic": list(ic[:m])}


def header(handle: int, ifnlen: int):
    if ifnlen < 1:
        raise ValueError("DAF internal file name capacity must be positive")
    capacity = min(ifnlen, 61)
    name = ct.create_string_buffer(capacity)
    nd, ni, fward, bward, free = (_i() for _ in range(5))
    _header(handle, capacity, ct.byref(nd), ct.byref(ni), name, ct.byref(fward),
            ct.byref(bward), ct.byref(free))
    sp.check_for_spice_error(None)
    return dict(nd=nd.value, ni=ni.value, ifname=name.value.decode("utf-8"),
                fward=fward.value, bward=bward.value, free=free.value)


_native_format = _lib.zzddhisn_
_native_format.argtypes = [_ip, _ip, _ip]
_native_format.restype = ct.c_int
_numeric_record = _lib.zzdafgdr_
_numeric_record.argtypes = [_ip, _ip, _dp, _ip]
_numeric_record.restype = ct.c_int


def _check_foreign_summary(handle: int, recno: int) -> None:
    h, record = _i(handle), _i(recno)
    native, known = _i(), _i()
    _native_format(ct.byref(h), ct.byref(native), ct.byref(known))
    sp.check_for_spice_error(None)
    if native.value or not known.value:
        return
    # An untrusted foreign-format record is translated using its summary
    # count as a loop bound. Read the control words independently without
    # marking this record as decimal data in the toolkit's record cache.
    words, found = (_d * 128)(), _i()
    _numeric_record(ct.byref(h), ct.byref(record), words, ct.byref(found))
    sp.check_for_spice_error(None)
    if found.value:
        nd, ni = sp.dafhsf(handle)
        size = nd + (ni + 1) // 2
        if not (0 <= nd <= 124 and 2 <= ni <= 250 and size <= 125):
            raise ValueError("Invalid DAF summary file format")
        n = words[2]
        if not math.isfinite(n) or not n.is_integer() or not 0 <= n <= 125 // size:
            raise ValueError("Invalid non-native DAF summary record count")


def summary_record(handle: int, recno: int, begin: int, end: int):
    _check_foreign_summary(handle, recno)
    start, stop = max(1, begin), min(128, end)
    if start > stop:
        # Observe record lookup even when the clipped subrange is empty.
        start, stop = 1, 0
    words, found = (_d * 128)(), _i()
    _record(handle, recno, start, stop, words, ct.byref(found))
    sp.check_for_spice_error(None)
    if not found.value:
        return {"found": False}
    return {"found": True, "data": list(ct.string_at(words, (stop - start + 1) * 8))}


def read_addresses(handle: int, begin: int, end: int, *, physical: bool):
    count = end - begin + 1 if 0 < begin <= end else 0
    if count > 33554432:
        raise ValueError("DAF address range exceeds 256 MiB")
    words = (_d * max(1, count))()
    read = _physical if physical else _logical
    read(handle, begin, end, words)
    sp.check_for_spice_error(None)
    if physical:
        return list(ct.string_at(words, count * 8))
    return list(words[:count])
