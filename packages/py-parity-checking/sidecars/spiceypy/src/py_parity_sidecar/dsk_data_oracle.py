"""Observe CSPICE's independently returned n, discarded by four 6.0.3 wrappers."""
import ctypes as ct
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceDLADescr

_lib = ct.CDLL(libspice._name)
_int = ct.c_int
_double = ct.c_double
for _name, _t, _w in (("dskd02", _double, 1), ("dski02", _int, 1),
                       ("dskp02", _int, 3), ("dskv02", _double, 3)):
    _fn = getattr(_lib, _name + "_c")
    _fn.restype = None
    _fn.argtypes = ([_int, ct.POINTER(SpiceDLADescr)] + ([_int] if _w == 1 else []) +
                    [_int, _int, ct.POINTER(_int), ct.POINTER(_t if _w == 1 else _t * 3)])


def read_page(name, handle, descriptor, item, start, room):
    width = 3 if name in ("dskp02", "dskv02") else 1
    integer = name in ("dski02", "dskp02")
    words = descriptor.isize if integer else descriptor.dsize
    if not -(2**31) <= start < 2**31 or not -(2**31) <= room < 2**31:
        raise ValueError("Invalid signed integer page argument")
    if width == 1:
        if start == 2**31-1:
            raise ValueError("Unrepresentable one-based internal offset")
        if room > 0 and name == "dski02" and item in (1, 2, 3, 5, 6, 7, 8) and start != 0:
            raise ValueError("Undefined scalar item offset")
        if room > 0 and ((integer and item in (4,9,10,11,12,13,14)) or
                         (not integer and 15 <= item <= 19)):
            # All registered windows are within safe address arithmetic. Restrict
            # extreme unverified offsets independently of the native shim.
            upper = (descriptor.ibase if integer else descriptor.dbase) + words
            if start > 2**31-2-max(upper, 0):
                raise ValueError("Unrepresentable internal item address")
    if width == 3 and 3 * room < -(2**31):
        raise ValueError("Unrepresentable negative record capacity")
    room = min(room, words // width)
    count = _int(0)
    dtype = _int if integer else _double
    row = dtype if width == 1 else dtype * 3
    cap = max(1, room)
    # Both adjacent guard rows must survive the canonical write.
    guard = -1367 if integer else -2819.5
    buffer = (dtype * ((cap + 2) * width))(*([guard] * ((cap + 2) * width)))
    ptr = ct.cast(ct.byref(buffer, width * ct.sizeof(dtype)), ct.POINTER(row))
    args = [handle, ct.byref(descriptor)]
    if width == 1:
        args.append(item)
    getattr(_lib, name + "_c")(*args, start, room, ct.byref(count), ptr)
    if list(buffer[:width])+list(buffer[-width:]) != [guard]*(2*width):
        raise AssertionError("DSK page boundary changed")
    sp.check_for_spice_error(None)
    if not 0 <= count.value <= room:
        raise AssertionError("Invalid toolkit output count")
    if any(x != guard for x in buffer[(1+count.value)*width:(cap+1)*width]):
        raise AssertionError("DSK page wrote beyond the reported count")
    actual = list(buffer[width:(count.value+1)*width])
    if width == 3:
        return [actual[j:j+3] for j in range(0, len(actual), 3)]
    return actual
