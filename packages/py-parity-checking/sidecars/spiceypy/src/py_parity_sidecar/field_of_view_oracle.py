"""Observe byte-limited fields and full corner rows from the independent N0067 library."""

import ctypes as c

import spiceypy as sp

from . import geometry_quantities_oracle as g

_vec = c.c_double * 3
_outputs = [c.c_int] * 3 + [c.c_void_p] * 5
_getfov = g._bind("getfov_c", [c.c_int, *_outputs])
_getfvn = g._bind("getfvn_c", [c.c_char_p, *_outputs])


def _read(call, instrument, room, shapelen, framelen):
    # N0067 pool limits cap the possible output at 400000 numbers and
    # 80 bytes per character value. The C call still sees the caller's
    # short widths, which affect both output and shape interpretation.
    if room < -715827882:
        raise ValueError("FOV room overflows the toolkit component count")
    room = min(room, 133334)
    shapelen, framelen = min(shapelen, 81), min(framelen, 81)
    shape = c.create_string_buffer(max(1, shapelen))
    frame = c.create_string_buffer(max(1, framelen))
    bsight, count, bounds = _vec(), c.c_int(), (_vec * max(1, room))()
    call(instrument, room, shapelen, framelen, shape, frame, bsight, c.byref(count), bounds)
    sp.check_for_spice_error(None)
    return dict(shape=shape.value.decode("utf8", "strict"), frame=frame.value.decode("utf8", "strict"),
                bsight=list(bsight), n=count.value, bounds=[list(row) for row in bounds[:count.value]])


def getfov(instid, room, shapelen, framelen):
    return _read(_getfov, instid, room, shapelen, framelen)


def getfvn(inst, room, shapelen, framelen):
    encoded = g._text(inst)
    if encoded and shapelen >= 2 and framelen >= 2:
        g._body_table_guard()
        with g._trace(b"getfvn_c", b"GETFVN"):
            with sp.no_found_check():
                _, found = sp.bods2c(inst)
            if not found:
                sp.setmsg("'#' is not a recognized name for an instrument. The cause of this problem may be that you have not loaded a required frame kernel or instrument kernel.")
                sp.errch("#", inst)
                g._signal(b"SPICE(IDCODENOTFOUND)")
        sp.check_for_spice_error(None)
    return _read(_getfvn, encoded, room, shapelen, framelen)


def fovray(inst, raydir, rframe, abcorr, observer, et):
    if inst and rframe and abcorr and observer:
        g._body_table_guard()
    return bool(sp.fovray(inst, raydir, rframe, abcorr, observer, et))


def fovtrg(inst, target, tshape, tframe, abcorr, observer, et):
    if inst and target and tshape and abcorr and observer and tshape.strip().upper() != "RAY":
        g._body_table_guard()
    return bool(sp.fovtrg(inst, target, tshape, tframe, abcorr, observer, et))
