"""Independent N0067 metadata; only inspect defined widths and result fields."""
import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceEKAttDsc, SpiceEKSegSum

_library = ct.CDLL(libspice._name)
I, T = ct.c_int, ct.c_char_p
P = ct.POINTER(I)


def symbol(name, args, result=None):
    fn = getattr(_library, name)
    fn.argtypes, fn.restype = args, result
    return fn


_cii = symbol("ekcii_", [T, P, T, P, I, I], I)
_nelt = symbol("eknelt_", [P, P, P], I)
_checkin = symbol("chkin_c", [T])
_checkout = symbol("chkout_c", [T])
_convert = symbol("F2C_ConvertStr", [I, T])
_width_check = symbol("ekcii_c", [T, I, I, T, ct.POINTER(SpiceEKAttDsc)])


def ordinal(i):
    if not -2**31 <= i < 2**31 - 1:
        raise ValueError("EK ordinal exceeds one-based range")
    return I(i + 1)


def traced(name, fn, *args):
    _checkin(name)
    try:
        fn(*args)
    finally:
        _checkout(name)
    sp.check_for_spice_error(None)


def attr(a):
    return dict(cclass=a.cclass, dtype=a.dtype, strlen=a.strlen, size=a.size,
                indexd=bool(a.indexd), nullok=bool(a.nullok))


def ekcii(table, index, width):
    idx, a, t = ordinal(index), (I * 6)(), table.encode()
    if b"\0" in t or not -2**31 <= width < 2**31:
        raise ValueError("Invalid EK name or width")
    width = min(width, 33)
    col = ct.create_string_buffer(max(1, width))
    if width < 2:
        # The canonical C adapter checks width before it reads any descriptor.
        _width_check(t, index, width, col, ct.byref(SpiceEKAttDsc()))
        sp.check_for_spice_error(None)
    traced(b"ekcii_c", _cii, t, ct.byref(idx), col, a, len(t), width - 1)
    _convert(width, col)
    result = dict(column=col.value.decode(), attdsc=dict(cclass=a[0], dtype=a[1]-1,
                  strlen=a[2], size=a[3], indexd=a[4]>=0, nullok=a[5]>=0))
    # Only now is the original C adapter known to initialize its private descriptor.
    name, descriptor = sp.ekcii(table, index, width)
    assert result == dict(column=name, attdsc=attr(descriptor))
    return result


def eknelt(index, row):
    i, r, n = ordinal(index), ordinal(row), I()
    traced(b"eknelt_c", _nelt, ct.byref(i), ct.byref(r), ct.byref(n))
    assert n.value == sp.eknelt(index, row)
    return n.value


def ekssum(handle, segment):
    ordinal(segment)
    s = sp.ekssum(handle, segment)
    # SpiceyPy 6.0.3 interchanges the two C array extents for cnames.
    start = ct.addressof(s) + SpiceEKSegSum._cnames.offset
    names = [ct.string_at(start + 33*i, 33).split(b"\0", 1)[0].decode() for i in range(s.ncols)]
    return dict(tabnam=s.tabnam, nrows=s.nrows, ncols=s.ncols, cnames=names,
                cdescrs=[attr(a) for a in s.cdescrs[:s.ncols]])


def ekpsel(query):
    n, starts, ends, types, classes, tabs, cols, error, msg = sp.ekpsel(query, 1841, 65, 33)
    if error:
        return dict(ok=False, errmsg=msg)
    return dict(ok=True, n=n, xbegs=starts.tolist(), xends=ends.tolist(),
                xtypes=types.tolist(), xclass=classes.tolist(), tabs=list(tabs), cols=list(cols))
