"""Independent N0067 Jacobian oracle and narrowly scoped caller-domain checks."""
import ctypes as c
import math

import spiceypy as sp

_lib = c.CDLL(sp.libspice._name)
_intptr = c.POINTER(c.c_int)
_lib.gcpool_c.argtypes = [c.c_char_p, c.c_int, c.c_int, c.c_int, _intptr, c.c_void_p, _intptr]
_lib.gcpool_c.restype = None


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
        _lib.gcpool_c(b"NAIF_BODY_NAME", start, 32, width, c.byref(count), rows, c.byref(found))
        sp.check_for_spice_error(None)
        for i in range(count.value):
            if not rows[i * width : (i + 1) * width].split(b"\x00", 1)[0].strip(b" "):
                return
    raise ValueError("body mapping contains a code outside the supported hash domain")


def _body(name: str) -> None:
    if not name:
        return  # CHKFSTR returns before entering ZZBODS2C.
    if "\0" in name or len(name.encode()) >= 2**31:
        raise ValueError("invalid body string")
    _body_table_guard()
    with sp.no_found_check():
        _, found = sp.bods2c(name)
    if not found:
        # The N0067 Jacobian caller supplies an unwritten local to the
        # ZZBODS2C cache on a miss. Observe the independent BODS2C flag,
        # then return that published Jacobian diagnostic through SPICE.
        sp.setmsg("The value of the input argument BODY is #, this is not a recognized name of an ephemeris object. The cause of this problem may be that you need an updated version of the SPICE Toolkit. ")
        sp.errch("#", name)
        sp.sigerr("SPICE(IDCODENOTFOUND)")


def _surface(x: float, y: float, z: float, re: float, f: float) -> None:
    if re <= 0 or f >= 1 or (x == 0 and y == 0):
        return
    polar = re - re*f
    if not math.isfinite(polar) or (polar > 0 and not math.isfinite(1/min(re, polar))):
        raise ValueError("Reference axes exceed the N0067 nearest-point scaling range")
    # The public wrapper reports NEARPT's actual error before RECGEO can
    # pass a still-unwritten normal to its error-free reclat_ callee.
    sp.nearpt([x, y, z], re, re, polar)


def dgeodr(x, y, z, re, f):
    _surface(x,y,z,re,f)
    return sp.dgeodr(x,y,z,re,f)


def dpgrdr(body, x, y, z, re, f):
    _body(body)
    if body and re > 0 and f < 1 and (x != 0 or y != 0):
        # Observe body policy ahead of an extreme ellipsoid or position.
        sp.dpgrdr(body, 1., 0., 0., 1., 0.)
        _surface(x,y,z,re,f)
    return sp.dpgrdr(body,x,y,z,re,f)


def drdpgr(body, lon, lat, alt, re, f):
    _body(body)
    return sp.drdpgr(body,lon,lat,alt,re,f)
