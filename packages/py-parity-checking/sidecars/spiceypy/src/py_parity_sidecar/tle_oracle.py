"""Independent scientific results from the two public wrappers in the locked wheel."""
from __future__ import annotations

import ctypes
import math
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice


def parse_tle(first_year: int, lines: list[str]):
    if len(lines) != 2 or not -(2**31) <= first_year < 2**31:
        raise ValueError("Expected two ASCII records and a SpiceInt first year")
    rows = []
    for line in lines:
        if not isinstance(line, str) or not line.isascii() or "\x00" in line or len(line) >= 134217728:
            raise ValueError("Expected two bounded NUL-free ASCII records")
        rows.append(line.ljust(7))
    unsafe_year = abs(first_year) > 5000000
    unsafe_day = False
    if len(rows[0]) >= 32:
        # NPARSD parses the same 12-byte field as ZZGETELM without disturbing
        # SPICE's error status on ordinary invalid text.
        parse = ctypes.CDLL(libspice._name).nparsd_
        parse.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_double), ctypes.POINTER(ctypes.c_char),
                          ctypes.POINTER(ctypes.c_int), ctypes.c_int, ctypes.c_int]
        parse.restype = ctypes.c_int
        day, pos, diag = ctypes.c_double(), ctypes.c_int(), ctypes.create_string_buffer(160)
        parse(rows[0][20:32].encode("ascii"), ctypes.byref(day), diag, ctypes.byref(pos), 12, 160)
        unsafe_day = diag.raw[:1] == b" " and (not math.isfinite(day.value) or abs(day.value) > 300000000)
        if unsafe_day:
            rows[0] = rows[0][:20] + "001.00000000" + rows[0][32:]
    epoch, elems = sp.getelm(2000 if unsafe_year else first_year, max(map(len, rows))+1, rows)
    if unsafe_year or unsafe_day:
        raise ValueError("TLE epoch exceeds the supported signed calendar day range")
    return {"epoch": float(epoch), "elems": elems.tolist()}


def propagate_tle(et: float, geophs: list[float], elems: list[float]):
    if (len(geophs) != 8 or len(elems) != 10 or
            not all(map(math.isfinite, [et, *geophs, *elems])) or abs(elems[9]) > 1.6e14):
        raise ValueError("Expected finite SGP4 tuples and representable element epoch")
    def evaluate(when: float):
        # The locked EVSGP4 wrapper omits the normal SpiceyPy error decorator.
        state = sp.evsgp4(when, geophs, elems)
        sp.check_for_spice_error(None)
        return state.tolist()

    if abs(et-elems[9]) >= 43200000000:
        # A large resonant call integrates in half-day increments. Classify with
        # the independent library's initialization and the original ZZDSIN bounds.
        scalar = ctypes.c_double
        dp = ctypes.POINTER(scalar)
        init = ctypes.CDLL(libspice._name).zzinil_
        init.argtypes = [dp, ctypes.POINTER(ctypes.c_int)] + [dp]*17
        init.restype = ctypes.c_int
        words = [scalar(value) for value in (elems[5], 0, elems[3], elems[8], *([0]*13))]
        init((scalar*8)(*geophs), ctypes.byref(ctypes.c_int(2)), *(ctypes.byref(w) for w in words))
        sp.check_for_spice_error(None)
        motion = words[3].value
        if .0034906585 < motion < .0052359877 or (.00826 <= motion <= .00924 and elems[5] >= .5):
            # Preserve only true initialization failures; a separate state
            # evaluation at the elements epoch could have different errors.
            init_sgp4 = ctypes.CDLL(libspice._name).xxsgp4i_
            init_sgp4.argtypes = [dp, dp, ctypes.POINTER(ctypes.c_int)]
            init_sgp4.restype = ctypes.c_int
            libspice.chkin_c(b"evsgp4_c")
            libspice.chkin_c(b"EVSGP4")
            try:
                init_sgp4((scalar*8)(*geophs), (scalar*10)(*elems), ctypes.byref(ctypes.c_int(1)))
            finally:
                libspice.chkout_c(b"EVSGP4")
                libspice.chkout_c(b"evsgp4_c")
            sp.check_for_spice_error(None)
            raise ValueError("SGP4 resonant interval reaches one million integration steps")
    return evaluate(et)
