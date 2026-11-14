"""Physical EK entry I/O using the library loaded by locked SpiceyPy."""
import ctypes as ct
import math

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
I, D, T, V = ct.c_int, ct.c_double, ct.c_char_p, ct.c_void_p
P = ct.POINTER(I)
LIMIT = 256 * 1024 * 1024


def _symbol(name, args, result=None):
    f = getattr(_lib, name)
    f.argtypes, f.restype = args, result
    return f


_mloc = _symbol("zzekmloc_", [P, P, P, P], I)
_cdsc = _symbol("zzekcdsc_", [P, P, T, P, I], I)
_record = _symbol("zzektrdp_", [P, P, P, P], I)
_size = _symbol("zzekesiz_", [P, P, P, P], I)
_access = _symbol("zzekpgch_", [P, T, I], I)
_checkin = _symbol("chkin_c", [T])
_checkout = _symbol("chkout_c", [T])
_convert = _symbol("F2C_ConvertStrArr", [I, I, V])
_readers = {
    k: _symbol("ekrce" + k + "_", [P, P, P, T, P, V, P, I] + ([I] if k == "c" else []), I)
    for k in "cdi"
}
_readc = _symbol("ekrcec_c", [I, I, I, T, I, P, V, P])
_writec = {p: _symbol(p + "c_c", [I, I, I, T, I, I, V, I]) for p in ("ekace", "ekuce")}
_update_double = _symbol("ekuced_c", [I, I, I, T, I, ct.POINTER(D), I])
_emptyc = {p: _symbol(p + "c_", [P, P, P, T, P, V, P, I, I], I) for p in ("ekace", "ekuce")}


def _traced(name, fn, *args):
    tag = (name + "_c").encode()
    _checkin(tag)
    try:
        return fn(*args)
    finally:
        _checkout(tag)
        sp.check_for_spice_error(None)


def _text(value):
    data = value.encode("utf-8")
    if b"\0" in data or len(data) >= LIMIT:
        raise ValueError("Invalid EK text")
    return data


def _string_error(name, h, s, r, col, width):
    """These C checks return before entering the reader or touching output rows."""
    n, null, dummy = I(), I(), ct.create_string_buffer(8)
    if name == "ekrcec":
        _readc(h, s, r, col, width, ct.byref(n), dummy, ct.byref(null))
    elif name.startswith("ekr"):
        getattr(sp, name)(h, s, r, col.decode(), 1)
    elif name.endswith("c"):
        _writec[name[:-1]](h, s, r, col, 1, 2, dummy, 0)
    else:
        getattr(sp, name)(h, s, r, col.decode(), 1, [0], False)
    sp.check_for_spice_error(None)
    raise AssertionError("Expected a canonical string error")


def entry(name, handle, segno, recno, column, *, values=None, is_null=False, width=1024):
    """Measure the entry on the independently opened file before allocating a result."""
    if not all(-2**31 <= i < 2**31 - 1 for i in (segno, recno)):
        raise ValueError("EK ordinal exceeds one-based conversion")
    col = _text(column)
    if not col or (name == "ekrcec" and width < 2):
        return _string_error(name, handle, segno, recno, col, width)

    h, s, r = I(handle), I(segno + 1), I(recno + 1)
    page, base, ptr = I(), I(), I()
    _traced(name, _mloc, ct.byref(h), ct.byref(s), ct.byref(page), ct.byref(base))
    segment = (I * 24)(*sp.dasrdi(handle, base.value + 1, base.value + 24))
    desc = (I * 11)()
    _traced(name, _cdsc, ct.byref(h), segment, col, desc, len(col))

    k = name[-1]
    reading = name.startswith("ekr")
    matched = desc[1] in {"c": (1,), "d": (2, 4), "i": (3,)}[k]
    if matched:
        if desc[0] >= 7 and (not reading or not 0 <= recno < segment[5]):
            raise ValueError("Fixed-count EK entries require a valid row and support reading only")
        if desc[0] <= 6:
            _traced(name, _record, ct.byref(h), ct.byref(I(segment[6])), ct.byref(r), ct.byref(ptr))

    if reading:
        count = 1
        if matched and 4 <= desc[0] <= 6:
            count = _traced(name, _size, ct.byref(h), segment, desc, ct.byref(ptr))
        return _read(name, h, s, r, col, count, width)

    if matched:
        _traced(name, _access, ct.byref(h), b"WRITE", 5)
        if not values and desc[0] <= 3:
            raise ValueError("A scalar EK entry requires a value or null placeholder")
        guard_null = name.startswith("eku") and desc[0] <= 2 and is_null and desc[7] != 1
        if (name.startswith("eka") and desc[0] >= 3) or guard_null:
            addr = ptr.value + 2 + desc[8]
            if int(sp.dasrdi(handle, addr, addr)[0]) not in (-1, -3):
                if guard_null:
                    raise ValueError("Cannot mark a populated non-nullable numeric scalar NULL")
                raise ValueError("EK add requires an uninitialized entry; use update")
        if k == "c" and desc[0] == 6 and not is_null and len(values) * desc[2] > LIMIT:
            raise ValueError("Stored EK character entry exceeds transfer limit")
    return _write(name, h, s, r, col, values, is_null)


def _write(name, h, s, r, col, values, is_null):
    count = len(values)
    k = name[-1]
    common = (h.value, s.value - 1, r.value - 1)
    if k == "c":
        rows = [_text(v) for v in values]
        stride = max(2, max(map(len, rows), default=0) + 1)
        if count * max(stride, ct.sizeof(V)) > LIMIT:
            raise ValueError("EK character entry exceeds transfer limit")
        if not count:
            _traced(name, _emptyc[name[:-1]], ct.byref(h), ct.byref(s), ct.byref(r),
                    col, ct.byref(I(0)), b" ", ct.byref(I(is_null)), len(col), 1)
            return None
        if all(x.isascii() and x for x in rows):
            return getattr(sp, name)(*common, col.decode(), count, values, is_null)
        buf = ct.create_string_buffer(b"".join(x.ljust(stride, b"\0") for x in rows), count * stride)
        _writec[name[:-1]](*common, col, count, stride, buf, is_null)
        sp.check_for_spice_error(None)
        return None

    if count * (4 if k == "i" else 8) > LIMIT or any(
        not math.isfinite(x) or (k == "i" and not -2**31 <= x < 2**31) for x in values
    ):
        raise ValueError("Invalid numeric EK entry")
    if name == "ekuced":
        # Locked 6.0.3 ekuced calls the add symbol, which cannot update a
        # populated scalar. Bind the actual update in the same oracle library.
        buf = (D * max(1, count))(*(values or [0]))
        _update_double(*common, col, count, buf, is_null)
        sp.check_for_spice_error(None)
        return None
    return getattr(sp, name)(*common, col.decode(), count, values or [0], is_null)


def _read(name, h, s, r, col, count, width):
    k = name[-1]
    stride = width if k == "c" else 8 if k == "d" else 4
    if count < 1 or stride < 1 or count * stride > LIMIT:
        raise ValueError("EK read extent exceeds transfer limit")
    buf = (ct.c_char * (count * width))() if k == "c" else ((D if k == "d" else I) * count)()
    extent, flag = I(), I()
    # The public C readers copy an indeterminate private logical after errors.
    # Compare them only after the initialized inner reader has succeeded.
    _traced(name, _readers[k], ct.byref(h), ct.byref(s), ct.byref(r), col, ct.byref(extent),
            buf, ct.byref(flag), len(col), *([width - 1] if k == "c" else []))
    assert extent.value == count
    common = (h.value, s.value - 1, r.value - 1)
    if k == "c":
        if not flag.value:
            _convert(count, width, buf)
        raw = ct.create_string_buffer(count * width)
        n, f = I(), I()
        _readc(*common, col, width, ct.byref(n), raw, ct.byref(f))
        sp.check_for_spice_error(None)
        assert (n.value, f.value) == (count, flag.value)
        result = []
        if not flag.value:
            assert raw.raw == bytes(buf)
            result = [raw.raw[i * width:(i + 1) * width].split(b"\0", 1)[0].decode()
                      for i in range(count)]
    else:
        n, vals, f = getattr(sp, name)(*common, col.decode(), count)
        assert (int(n), bool(f)) == (count, bool(flag.value))
        result = [] if f else vals.tolist()
        if not f:
            assert result == list(buf)
    return {"nvals": count, "isNull": bool(flag.value), "values": result}
