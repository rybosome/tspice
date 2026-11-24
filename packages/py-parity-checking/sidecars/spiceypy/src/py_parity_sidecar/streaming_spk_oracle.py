"""Use SpiceyPy’s real type-14 writers with independent physical-buffer checks."""
import ctypes
import math

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice_path

from .models import StepEphemerisSpk14a, StepEphemerisSpk14b


def select_array(handle):
    # Other SPK writers can change the active DAF array independently of
    # SGSEQW's last-handle optimization. DAFCAD selects this actual file.
    select = ctypes.CDLL(str(libspice_path)).dafcad_
    select.argtypes = [ctypes.POINTER(ctypes.c_int)]
    select.restype = ctypes.c_int
    select(ctypes.byref(ctypes.c_int(handle)))
    sp.check_for_spice_error(None)


def check_generic_begin(state, handle, segid, *, streaming):
    active = state.spk14_degrees
    if not active:
        return
    if handle in active:
        if streaming and state.spk14_last == handle:
            return
        raise ValueError("Finish the active type 14 stream first")
    text = segid.encode().rstrip(b" ")
    if len(active) == 20 or len(text) > 40 or any(not 32 <= c <= 126 for c in text):
        raise ValueError("Cannot begin another generic segment while type 14 is active")


def stream(state, handle, step):
    degrees = state.spk14_degrees
    if isinstance(step, StepEphemerisSpk14b):
        if not all(-(2**31) <= x < 2**31 for x in (step.degree, step.body, step.center)):
            raise ValueError("SPK14 integer exceeds signed 32-bit")
        if step.degree > 357913939 or not all(map(math.isfinite, (step.first, step.last))):
            raise ValueError("Undefined SPK14 degree or times")
        if "\0" in step.frame or "\0" in step.segid:
            raise ValueError("Embedded NUL in SPK14 string")
        check_generic_begin(state, handle, step.segid, streaming=True)
        sp.spk14b(handle, step.segid, step.body, step.center, step.frame,
                  step.first, step.last, step.degree)
        degrees[handle] = step.degree
        state.spk14_last = handle
    elif isinstance(step, StepEphemerisSpk14a):
        if not -(2**31) <= step.count < 2**31:
            raise ValueError("Invalid type 14 count")
        rows = times = [0.0]
        if step.count > 0:
            if handle in degrees:
                if (len(step.epochs) != step.count or
                    len(step.records) != step.count * (2 + 6 * (1 + degrees[handle])) or
                    len(step.records) + len(step.epochs) > 33554432):
                    raise ValueError("Incomplete or oversized SPK14 buffers")
                if not all(math.isfinite(v) for data in (step.records, step.epochs) for v in data):
                    raise ValueError("Nonfinite type 14 packet")
                rows, times = step.records, step.epochs
                select_array(handle)
                state.spk14_last = handle
            elif degrees:
                raise ValueError("No active type 14 segment for this writer")
        sp.spk14a(handle, step.count, rows, times)
    else:
        if handle in degrees:
            select_array(handle)
            state.spk14_last = handle
        elif degrees:
            raise ValueError("No active type 14 segment for this writer")
        sp.spk14e(handle)
        degrees.pop(handle, None)
