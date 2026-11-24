"""Independent N0067 spacecraft clock calls on the locked SpiceyPy library."""

from __future__ import annotations

import ctypes as ct
import math
import sys

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

# SpiceZfc.h: int sce2t_(integer *, doublereal *, doublereal *). The locked
# toolkit uses 32-bit integer and 64-bit doublereal on both supported lanes.
_lib = ct.CDLL(libspice._name)
_integer, _double = ct.c_int, ct.c_double
if ct.sizeof(_integer) != 4 or ct.sizeof(_double) != 8:
    raise RuntimeError("Unexpected SpiceInt/SpiceDouble ABI")
_sce2t = _lib.sce2t_
_sce2t.argtypes = [ct.POINTER(_integer), ct.POINTER(_double), ct.POINTER(_double)]
_sce2t.restype = ct.c_int
_scfmt = _lib.scfmt_c
_scfmt.argtypes = [_integer, _double, _integer, ct.POINTER(ct.c_char)]
_scfmt.restype = None
_lib.chkin_c.argtypes = _lib.chkout_c.argtypes = [ct.c_char_p]
_lib.chkin_c.restype = _lib.chkout_c.restype = None


def _spacecraft(sc: int) -> None:
    # N0067 constructs kernel variable names using the signed negation of SC.
    if type(sc) is not int or not -(2**31) < sc < 2**31:
        raise ValueError("Spacecraft ID must have a representable signed32 negation")


def sce2t(sc: int, et: float) -> float:
    _spacecraft(sc)
    if not math.isfinite(et):
        raise ValueError("ET must be finite")
    spacecraft, epoch, ticks = _integer(sc), _double(et), _double(0)
    # sce2t_c copies an uninitialized local result on early toolkit errors.
    # The same SPICELIB implementation is safe with initialized output. Keep
    # the C routine's outer trace frame; checkout must precede error reset.
    _lib.chkin_c(b"sce2t_c")
    try:
        _sce2t(ct.byref(spacecraft), ct.byref(epoch), ct.byref(ticks))
    finally:
        _lib.chkout_c(b"sce2t_c")
    sp.check_for_spice_error(None)
    # Only a successful return enters the public wrapper on identical state.
    observed = sp.sce2t(sc, et)
    if observed != ticks.value:
        raise AssertionError("Public and SPICELIB integral clock counts disagree")
    return float(observed)


def scpart(sc: int) -> dict[str, list[float]]:
    _spacecraft(sc)
    # The locked wrapper allocates both full 9999-double buffers, then slices
    # both at the toolkit's returned partition count.
    starts, stops = sp.scpart(sc)
    return {"pstart": starts.tolist(), "pstop": stops.tolist()}


def sctiks(sc: int, clock: str) -> float:
    _spacecraft(sc)
    encoded = clock.encode("utf-8", "strict")
    if b"\0" in encoded or len(encoded) >= 2**31 - 1:
        raise ValueError("Invalid spacecraft clock C string")
    return float(sp.sctiks(sc, clock))


def _pool_numbers(prefix: str, sc: int, room: int) -> list[float]:
    with sp.no_found_check():
        values, found = sp.gdpool(f"{prefix}_{-sc}", 0, room)
    return values.tolist() if found else []


def _check_format_domain(sc: int, ticks: float, clklen: int) -> None:
    """Protect the fixed SCFM01 component workspace using live clock metadata."""
    if clklen < 2:
        return  # The C wrapper diagnoses the logical buffer length first.
    # SCPR01 can seed SCTY01's same-spacecraft cache regardless of the
    # current SCLK_DATA_TYPE value. Check actual fields even in that state.
    mods = _pool_numbers("SCLK01_MODULI", sc, 11)
    offsets = _pool_numbers("SCLK01_OFFSETS", sc, 11)
    if not 1 <= len(mods) <= 10 or len(mods) != len(offsets) or any(m < 1 for m in mods):
        return  # The clock loader reports the missing/invalid metadata.

    bases = [1.0] * len(mods)
    for i in reversed(range(len(mods))):
        width_arg = (mods[i] + offsets[i] - 1.0) + 0.5
        if not math.isfinite(width_arg) or width_arg <= 0:
            raise ValueError("Clock field width outside formatter domain")
        if i:
            bases[i - 1] = bases[i] * mods[i]
            if not math.isfinite(bases[i - 1]):
                raise ValueError("Clock modulus product outside formatter domain")

    # Bound the sizes only. Actual field decomposition, output delimiters and
    # clock rounding are observed from the locked SCFMT implementation.
    remaining = float(math.floor(ticks + 0.5))
    if remaining < 0:
        return
    epsilon = sys.float_info.epsilon
    if len(mods) > 1 and remaining > sys.float_info.max * (1.0 - 8.0 * epsilon):
        raise ValueError("Clock remainder outside formatter domain")
    for base, offset in zip(bases, offsets):
        if not remaining / base + abs(offset) < 1e28 * (1.0 - 1e-13):
            raise ValueError("Clock component outside formatter domain")
        remaining = min(remaining, base + 8.0 * epsilon * remaining)


def scfmt(sc: int, ticks: float, clklen: int = 2048) -> str:
    _spacecraft(sc)
    if not math.isfinite(ticks) or type(clklen) is not int or not -(2**31) <= clklen < 2**31:
        raise ValueError("Invalid clock ticks or signed32 output length")
    _check_format_domain(sc, ticks, clklen)
    capacity = min(clklen, 3100)
    if capacity < 1:
        # SpiceyPy allocates from the signed length. Give the actual C length
        # check non-NULL backing storage even when the logical size is negative.
        _scfmt(sc, ticks, capacity, ct.create_string_buffer(1))
        sp.check_for_spice_error(None)
        raise AssertionError("SCFMT accepted a nonpositive output length")
    return sp.scfmt(sc, ticks, capacity)
