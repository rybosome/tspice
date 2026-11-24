"""Locked-library correction calls with checked SPICELIB prerequisites for N0067."""
import ctypes as ct
from contextlib import contextmanager

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

# Keep independent argument declarations private: the wheel declares SPKAPS'
# three-word acceleration as six, although its C header and SPICELIB read three.
lib = ct.CDLL(libspice._name)
I, D, C = ct.c_int, ct.c_double, ct.c_char_p
PI, PD = ct.POINTER(I), ct.POINTER(D)
V3, V6 = D * 3, D * 6

def _bind(name, args, result=None):
    fn = getattr(lib, name)
    fn.argtypes, fn.restype = args, result
    return fn

_enter = _bind("chkin_c", [C])
_leave = _bind("chkout_c", [C])
_failed = _bind("failed_c", [], I)
_parse = _bind("zzvalcor_", [C, PI, I], I)
_frame = _bind("irfnum_", [C, PI, I], I)
_geometry = _bind("spkgeo_", [PI, PD, C, PI, PD, PD, I], I)
_light = _bind("spkltc_", [PI, PD, C, C, PD, PD, PD, PD, I, I], I)
_stellar = _bind("zzstelab_", [PI, PD, PD, PD, PD, PD], I)
_accelerated = _bind("spkaps_c", [I, D, C, C, V6, V3, V6, PD, PD])
_normalize = _bind("ljucrs_", [PI, C, C, I, I], I)
_legacy = _bind("spkapp_", [PI, PD, C, PD, C, PD, PD, I, I], I)
_receive = _bind("stelab_", [PD, PD, PD], I)
_transmit = _bind("stlabx_", [PD, PD, PD], I)

def option(flag):
    if not flag:
        return flag
    normalized = ct.create_string_buffer(5)
    raw = flag.encode()
    _normalize(ct.byref(I(0)), raw, normalized, len(raw), 5)
    spelling = normalized.raw.rstrip(b" ")
    if spelling in (b"NONE", b"LT", b"LT+S", b"CN", b"CN+S", b"XLT", b"XLT+S", b"XCN", b"XCN+S"):
        return spelling.decode("ascii")
    return flag


@contextmanager
def trace(name):
    _enter(name)
    try:
        yield
    finally:
        _leave(name)

def barycentric(body, epoch, ref):
    state = V6()
    _geometry(ct.byref(I(body)), ct.byref(D(epoch)), ref, ct.byref(I(0)), state, ct.byref(D()), len(ref))
    return state

def stellar_state(target, et, ref, corr, observer, acceleration, transmit):
    apparent = V6()
    _light(ct.byref(I(target)), ct.byref(D(et)), ref, corr, observer, apparent,
           ct.byref(D()), ct.byref(D()), len(ref), len(corr))
    if not _failed():
        _stellar(ct.byref(I(transmit)), acceleration, V3(*observer[3:]), apparent, V3(), V3())

def modern_preflight(op, target, et, frame, flag, observer_id=None, observer_state=None, acceleration=None):
    ref, corr = frame.encode(), flag.encode()
    if not ref or not corr:
        return
    with trace(op.encode() + b"_c"), trace(op.upper().encode()):
        attrs, index = (I * 15)(), I()
        _parse(corr, attrs, len(corr))
        if not _failed() and attrs[2]:
            _frame(ref, ct.byref(index), len(ref))
            if index.value:
                if observer_id is None:
                    stellar_state(target, et, ref, corr, V6(*observer_state), V3(*acceleration), attrs[4])
                else:
                    state = barycentric(observer_id, et, ref)
                    if not _failed():
                        before = barycentric(observer_id, et - 1, ref)
                    if not _failed():
                        after = barycentric(observer_id, et + 1, ref)
                    if not _failed():
                        acc = V3(*sp.qderiv(before[3:], after[3:], 1.0))
                        with trace(b"SPKAPS"):
                            stellar_state(target, et, ref, corr, state, acc, attrs[4])
    sp.check_for_spice_error(modern_preflight)

def spkacs(target, et, frame, flag, observer):
    flag = option(flag)
    modern_preflight("spkacs", target, et, frame, flag, observer_id=observer)
    return sp.spkacs(target, et, frame, flag, observer)

def spkaps(target, et, frame, flag, state, acceleration):
    flag = option(flag)
    modern_preflight("spkaps", target, et, frame, flag, observer_state=state, acceleration=acceleration)
    result, lt, dlt = V6(), D(), D()
    _accelerated(target, et, frame.encode(), flag.encode(), V6(*state), V3(*acceleration), result, ct.byref(lt), ct.byref(dlt))
    sp.check_for_spice_error(spkaps)
    return list(result), lt.value, dlt.value

def spkapp(target, et, frame, state, flag):
    flag = option(flag)
    ref, corr = frame.encode(), flag.encode()
    if ref and corr:
        norm = ct.create_string_buffer(5)
        _normalize(ct.byref(I(0)), corr, norm, len(corr), 5)
        normalized = norm.raw.rstrip()
        if normalized in (b"LT+S", b"CN+S", b"XLT+S", b"XCN+S"):
            base = normalized[:-2]
            result = V6()
            with trace(b"spkapp_c"):
                _legacy(ct.byref(I(target)), ct.byref(D(et)), ref, V6(*state), base, result, ct.byref(D()), len(ref), len(base))
                if not _failed():
                    with trace(b"SPKAPP"):
                        fn = _transmit if normalized.startswith(b"X") else _receive
                        fn(V3(*result[:3]), V3(*state[3:]), V3())
            sp.check_for_spice_error(spkapp)
    return sp.spkapp(target, et, frame, state, flag)

def ltime(etobs, observer, direction, target):
    if direction[:2] in ("->", "<-"):
        with trace(b"ltime_c"), trace(b"LTIME"):
            barycentric(observer, etobs, b"J2000")
            if not _failed():
                barycentric(target, etobs, b"J2000")
        sp.check_for_spice_error(ltime)
    return sp.ltime(etobs, observer, direction, target)
