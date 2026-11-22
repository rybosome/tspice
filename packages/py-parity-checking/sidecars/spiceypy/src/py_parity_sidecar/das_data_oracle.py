"""Owned native buffers for the N0067 DAS transfer routines in SpiceyPy's library."""
import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_word = ct.c_int
_pword = ct.POINTER(_word)
_LIMIT = 256 * 1024 * 1024


def _bind(name, args):
    fn = getattr(_lib, name)
    fn.argtypes = args
    fn.restype = None
    return fn


_adc = _bind("dasadc_c", [_word] * 5 + [ct.c_void_p])
_rdc = _bind("dasrdc_c", [_word] * 6 + [ct.c_void_p])
_udc = _bind("dasudc_c", [_word] * 6 + [ct.c_void_p])
_rdd = _bind("dasrdd_c", [_word] * 3 + [ct.POINTER(ct.c_double)])
_rdi = _bind("dasrdi_c", [_word] * 3 + [_pword])
_address = _lib.dasa2l_
_address.argtypes = [_pword] * 7
_address.restype = ct.c_int


def physical_word(handle, kind, address):
    """Read actual (one-based physical record, word) for a logical data address."""
    args = [_word(i) for i in [handle, kind, address, 0, 0, 0, 0]]
    _address(*(ct.byref(a) for a in args))
    sp.check_for_spice_error(None)
    return args[-2].value, args[-1].value


def _ints(*values):
    if any(isinstance(n, bool) or not isinstance(n, int) or not -(2**31) <= n < 2**31 for n in values):
        raise ValueError("Expected signed 32-bit DAS arguments")


def _validate_append(h, kind, n):
    width = (1024, 128, 256)[kind-1]
    summary = sp.dashfs(h)
    old = int(summary[5][kind-1])
    extra = max(0, n - ((-old) % width))
    records = (extra + width-1)//width
    if old + max(n, 0) > (2**31-1)//width*width or int(summary[4])+records+1 > 2**31-1:
        raise ValueError("Oracle DAS address range exceeds N0067 limits")


def _words(values, width):
    if len(values)*width > _LIMIT:
        raise ValueError("DAS transfer exceeds buffer limit")
    if width == 4:
        _ints(*values)


def _byte_transfer(fn, h, bounds, b, e, stride, data):
    _ints(*bounds, b, e, stride)
    if b == 2**31-1 or e == 2**31-1 or e == 2**31-2 and e < stride:
        raise ValueError("DAS character index exceeds N0067 bounds")
    if len(data) > _LIMIT:
        raise ValueError("DAS transfer exceeds buffer limit")
    raw = bytes(data)  # Reject out-of-range bytes before constructing the C buffer.
    storage = (ct.c_ubyte * max(1, len(raw)))()
    storage[:len(raw)] = raw
    slice_ok = 0 <= b <= e < stride
    if fn is _adc:
        n, = bounds
        if slice_ok:
            _validate_append(h, 1, n)
    else:
        first, last = bounds
        n = last-first+1
        if slice_ok:
            high = sp.daslla(h)[0]
            if fn is _rdc and not (1 <= first <= high and 1 <= last <= high):
                # An isolated, invalid FIRST reaches canonical DASA2L before any physical read.
                bad = first if not 1 <= first <= high else last
                fn(h, bad, bad, b, e, stride, storage)
                sp.check_for_spice_error(None)
                raise AssertionError("An invalid DAS address unexpectedly succeeded")
            if fn is _udc and not (1 <= first <= high and 1 <= last <= high):
                n = 0  # DASUDC itself diagnoses either endpoint before reading the source.
    if slice_ok and n > 0:
        width = e-b+1
        if (n+width-1)//width*stride > len(raw):
            raise ValueError("DAS oracle requires complete rows")
        if fn is _udc and b:
            # Track source rows using actual physical word of FIRST, independent
            # of file segregation. The N0067 cursor tests col > width starting
            # at the second physical record. Guard before calling the C routine.
            _, word = physical_word(h, 1, bounds[0])
            if n > 1025-word:
                k = row = 0
                col = b
                while k < n:
                    if col >= (e+1 if k < 1025-word else width):
                        row += 1
                        col = b
                    if (row+1)*stride > len(raw):
                        raise ValueError("DASUDC oracle needs an additional source row")
                    take = min(n-k, e-col+1, 1024-(word-1+k)%1024)
                    k += take
                    col += take
    fn(h, *bounds, b, e, stride, storage)
    sp.check_for_spice_error(None)
    return list(storage[:len(raw)]) if fn is _rdc else None


def dasadc(h, n, b, e, stride, data):
    return _byte_transfer(_adc, h, (n,), b, e, stride, data)


def dasrdc(h, first, last, b, e, stride, data):
    return _byte_transfer(_rdc, h, (first,last), b, e, stride, data)


def dasudc(h, first, last, b, e, stride, data):
    return _byte_transfer(_udc, h, (first,last), b, e, stride, data)


def _add(h, n, data, width, writer):
    _ints(n)
    _words(data, width)
    if n > len(data):
        raise ValueError("DAS append count exceeds input size")
    _validate_append(h, 2 if width == 8 else 3, n)
    return writer(h, n, data or [0])


def dasadd(h, n, data):
    return _add(h, n, data, 8, sp.dasadd)


def dasadi(h, n, data):
    return _add(h, n, data, 4, sp.dasadi)


def _read(h, first, last, width, reader, reverse):
    _ints(first, last)
    if max(0, last-first+1)*width > _LIMIT:
        raise ValueError("DAS read exceeds buffer limit")
    high = sp.daslla(h)[1 if width == 8 else 2]
    if not (1 <= first <= high and 1 <= last <= high):
        bad = first if not 1 <= first <= high else last
        reader(h, bad, bad)  # Defined failure in DASA2L before reading any physical words.
        raise AssertionError("An invalid DAS address unexpectedly succeeded")
    if last < first:
        sentinel = (ct.c_double if width == 8 else ct.c_int)(-713)
        reverse(h, first, last, ct.byref(sentinel))
        sp.check_for_spice_error(None)
        if sentinel.value != -713:
            raise AssertionError("Reversed DAS read wrote an element")
        return []
    return reader(h, first, last).tolist()


def dasrdd(h, first, last):
    return _read(h, first, last, 8, sp.dasrdd, _rdd)


def dasrdi(h, first, last):
    return _read(h, first, last, 4, sp.dasrdi, _rdi)


def _update(h, first, last, data, width, writer):
    _ints(first, last)
    _words(data, width)
    high = sp.daslla(h)[1 if width == 8 else 2]
    if 1 <= first <= high and 1 <= last <= high and last-first+1 > len(data):
        raise ValueError("DAS update count exceeds input size")
    return writer(h, first, last, data or [0])


def dasudd(h, first, last, data):
    return _update(h, first, last, data, 8, sp.dasudd)


def dasudi(h, first, last, data):
    return _update(h, first, last, data, 4, sp.dasudi)
