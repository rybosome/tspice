"""Guard N0067 intermediate states, then observe the independently installed public library."""

import ctypes as c
import math
from contextlib import contextmanager

import spiceypy as sp

_lib = c.CDLL(sp.libspice._name)
_d = c.c_double
_i = c.c_int
_ip = c.POINTER(_i)
_dp = c.POINTER(_d)
_str = c.c_char_p


def _bind(name, args, result=None):
    call = getattr(_lib, name)
    call.argtypes = args
    call.restype = result
    return call

_trgsep = _bind("trgsep_c", [_d] + [_str] * 8, _d)
_resolve = _bind("bods2c_", [_str, _ip, _ip, _i])
_tip = _bind("tipbod_", [_str, _ip, _dp, _dp, _i])
_geo = _bind("spkgeo_", [_ip, _dp, _str, _ip, _dp, _dp, _i])
_cross = _bind("ucrss_", [_dp, _dp, _dp])
_frame = _bind("twovec_", [_dp, _ip, _dp, _ip, _dp])
_apparent = _bind("spkezr_", [_str, _dp, _str, _str, _str, _dp, _dp] + [_i] * 4)
_gcpool = _bind("gcpool_c", [_str, _i, _i, _i, _ip, c.c_void_p, _ip])
_signal = _bind("sigerr_c", [_str])
_chkin = _bind("chkin_c", [_str])
_chkout = _bind("chkout_c", [_str])


def _text(value):
    encoded = value.encode("utf-8", "strict")
    if b"\0" in encoded or len(encoded) >= 2**31 - 1:
        raise ValueError("Geometry arguments must fit one NUL-terminated UTF-8 string")
    return encoded


def _et(value):
    if not math.isfinite(value):
        raise ValueError("ET must be finite")
    return _d(value)


def _body_table_guard() -> None:
    # ZZBODKER can hash all installed name/code pairs when resolving a name.
    # Only the signed minimum cannot participate in the pinned hash. GIPOOL
    # checks its entire numeric input's range before ZZBODINI is entered.
    with sp.no_found_check():
        nn, tn, fn = sp.dtpool("NAIF_BODY_NAME")
        nc, tc, fc = sp.dtpool("NAIF_BODY_CODE")
        if not (fn and fc and tn == "C" and tc == "N" and 0 < nn == nc <= 14983):
            return
        codes, _ = sp.gdpool("NAIF_BODY_CODE", 0, nc)
    if not all(-(2**31) <= code <= 2**31 - 1 for code in codes):
        return
    if not any(-(2**31) <= code <= -(2**31) + 0.5 for code in codes):
        return
    # ZZBODKER checks the original 36-byte Fortran names for blanks before
    # building the signed-code hash. Preserve that earlier toolkit diagnostic.
    for start in range(0, nn, 32):
        count, found = c.c_int(), c.c_int()
        width = 37
        rows = c.create_string_buffer(32 * width)
        _gcpool(b"NAIF_BODY_NAME", start, 32, width, c.byref(count), rows, c.byref(found))
        sp.check_for_spice_error(None)
        for i in range(count.value):
            if not rows[i * width : (i + 1) * width].split(b"\x00", 1)[0].strip(b" "):
                return
    raise ValueError("body mapping contains a code outside the supported hash domain")


def _pck_degree(body):
    system = body
    if 100 <= body <= 999:
        system = body // 100
    elif 10000 <= body <= 99999:
        system = body // 10000
    with sp.no_found_check():
        _, _, angles = sp.dtpool(f"BODY{system}_NUT_PREC_ANGLES")
        if not angles:
            return
        name = f"BODY{system}_MAX_PHASE_DEGREE"
        n, typ, found = sp.dtpool(name)
        if not found:
            return
        if typ == "N" and n == 1:
            values, _ = sp.gdpool(name, 0, 1)
            if -(2**31) - 0.5 < values[0] < 2**31 - 0.5:
                return
    raise ValueError("Unsupported N0067 PCK phase degree")

@contextmanager
def _trace(*labels):
    for label in labels:
        _chkin(label)
    try:
        yield
    finally:
        for label in reversed(labels):
            _chkout(label)


def _code(text):
    code, found = _i(), _i()
    _resolve(text, c.byref(code), c.byref(found), len(text))
    if sp.failed() or not found.value:
        return None
    if code.value == -(2**31):
        raise ValueError("Unsupported N0067 signed body hash")
    return code


def phaseq(et, target, illmn, observer, abcorr):
    _et(et)
    args = [_text(v) for v in (target, illmn, observer, abcorr)]
    if all(args):
        _body_table_guard()
        with _trace(b"phaseq_c", b"PHASEQ"):
            for role, name in zip(("target", "illuminator", "observer"), args[:3]):
                with _trace(b"ZZBODS2C"):
                    code = _code(name)
                if code is None:
                    if not sp.failed():
                        sp.setmsg(
                            "The #, '#', is not a recognized name for an ephemeris object. "
                            "The cause of this problem may be that you need an updated version of the SPICE Toolkit. "
                        )
                        sp.errch("#", role)
                        sp.errch("#", name.decode())
                        _signal(b"SPICE(IDCODENOTFOUND)")
                    break
        sp.check_for_spice_error(None)
    return sp.phaseq(et, target, illmn, observer, abcorr)


def trgsep(et, targ1, shape1, frame1, targ2, shape2, frame2, observer, abcorr):
    _et(et)
    args = [_text(v) for v in (targ1, shape1, frame1, targ2, shape2, frame2, observer, abcorr)]
    if all(args):
        _body_table_guard()
        # Ordinary name misses return safely through the original routine.
        with _trace(b"trgsep_c", b"TRGSEP", b"ZZSPIN"):
            for i in (0, 3, 6):
                if _code(args[i]) is None:
                    break
        sp.check_for_spice_error(None)
    # SpiceyPy 6.0.3 replaces both frames with "NULL", including empty frames.
    result = _trgsep(et, *args)
    sp.check_for_spice_error(None)
    return float(result)


def _seasonal_prerequisites(name, correction, t):
    with _trace(b"ZZBODS2C"):
        code = _code(name)
    if sp.failed():
        return
    if code is None:
        sp.setmsg(
            "The body name # could not be translated to a NAIF ID code.  "
            "The cause of this problem may be that you need an updated version of the SPICE Toolkit."
        )
        sp.errch("#", name.decode())
        _signal(b"SPICE(NOTRANSLATION)")
        return

    _pck_degree(code.value)
    matrix, state, apparent = (_d * 9)(), (_d * 6)(), (_d * 6)()
    axis, frame, lt = (_d * 3)(), (_d * 9)(), _d()
    _tip(b"J2000", c.byref(code), c.byref(t), matrix, 5)
    if sp.failed():
        return
    _geo(c.byref(code), c.byref(t), b"J2000", c.byref(_i(10)), state, c.byref(lt), 5)
    if sp.failed():
        return
    velocity = (_d * 3)(*state[3:])
    pole = (_d * 3)(matrix[2], matrix[5], matrix[8])
    _cross(state, velocity, axis)
    _frame(axis, c.byref(_i(3)), pole, c.byref(_i(2)), frame)
    if sp.failed():
        return
    _apparent(
        b"SUN", c.byref(t), b"J2000", correction, name, apparent, c.byref(lt),
        3, 5, len(correction), len(name),
    )


def lspcn(body, et, abcorr):
    name, correction = _text(body), _text(abcorr)
    t = _et(et)
    if name:
        _body_table_guard()
        with _trace(b"lspcn_c", b"LSPCN"):
            _seasonal_prerequisites(name, correction, t)
        sp.check_for_spice_error(None)
    # Successful scientific results always come from the original public routine.
    # Its empty-body guard exits before the translated orientation work.
    return sp.lspcn(body, et, abcorr)
