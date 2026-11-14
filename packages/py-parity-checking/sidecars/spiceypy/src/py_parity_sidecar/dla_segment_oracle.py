"""DLA calls in the locked SpiceyPy library on its own DAS files."""
import ctypes as ct
import spiceypy as sp

from .das_data_oracle import _validate_append

_lib = ct.CDLL(sp.libspice._name)
_ip = ct.POINTER(ct.c_int)
_read = _lib.dasrdi_
_read.argtypes = [_ip] * 4
_read.restype = ct.c_int
for _name in ("chkin_c", "chkout_c"):
    _fn = getattr(_lib, _name)
    _fn.argtypes = [ct.c_char_p]
    _fn.restype = None


def _invalid_address(h, address, routine):
    # The original DLA writer continues after an unsuccessful read. Obtain the
    # actual error from the same failing SPICELIB subcall with valid storage.
    outer = (routine + "_c").encode()
    inner = routine.upper().encode()
    _lib.chkin_c(outer)
    _lib.chkin_c(inner)
    try:
        word, handle, addr = ct.c_int(), ct.c_int(h), ct.c_int(address)
        _read(ct.byref(handle), ct.byref(addr), ct.byref(addr), ct.byref(word))
    finally:
        _lib.chkout_c(inner)
        _lib.chkout_c(outer)
    sp.check_for_spice_error(None)
    raise AssertionError("Invalid logical address unexpectedly succeeded")


def _checked_words(h, high, first, last, routine):
    for address in (first, last):
        if not 1 <= address <= high:
            _invalid_address(h, address, routine)
    return sp.dasrdi(h, first, last)


def _target(h, high, at, routine):
    if at > 2**31 - 8 or 0 < at < 4:
        raise ValueError("Invalid DLA descriptor address")
    return _checked_words(h, high, at, at+7, routine)


def last(h):
    high = sp.daslla(h)[2]
    target = int(_checked_words(h, high, 3, 3, "dlabbs")[0])
    if target != -1:
        _target(h, high, target, "dlabbs")
    with sp.no_found_check():
        return sp.dlabbs(h)


def previous(h, descriptor):
    if descriptor.bwdptr != -1:
        _target(h, sp.daslla(h)[2], descriptor.bwdptr, "dlafps")
    with sp.no_found_check():
        return sp.dlafps(h, descriptor)


def begin(h):
    # The native reader access check occurs before its header reads.
    if h < 0:
        high = sp.daslla(h)[2]
        head = _checked_words(h, high, 2, 3, "dlabns")
        if head[1] != -1:
            _target(h, high, int(head[1]), "dlabns")
        _validate_append(h, 3, 8)
    sp.dlabns(h)


def end(h):
    c, d, i = sp.daslla(h)
    at = int(_checked_words(h, i, 3, 3, "dlaens")[0])
    words = _target(h, i, at, "dlaens")
    if not all(0 <= base <= limit for base, limit in zip(words[2::2], (i,d,c))):
        raise ValueError("Invalid DLA component base address")
    sp.dlaens(h)
