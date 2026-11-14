"""Independent N0067 ellipsoid queries and guarded nested error paths."""

from contextlib import contextmanager
import ctypes as ct
import math

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_dp = ct.POINTER(ct.c_double)
_vec = ct.c_double * 3
_lib.surfpt_.argtypes = [_dp] * 6 + [ct.POINTER(ct.c_int)]
_lib.surfpt_.restype = ct.c_int


def surfpt(position, direction, a, b, c):
    """Use an initialized logical on failure; pair successes with the public wrapper."""
    point = _vec()
    hit = ct.c_int(0)
    radii = [ct.c_double(x) for x in (a, b, c)]
    sp.chkin("surfpt_c")
    _lib.surfpt_(
        _vec(*position),
        _vec(*direction),
        *(ct.byref(x) for x in radii),
        point,
        ct.byref(hit),
    )
    # The public chkout is an undecorated C call on a pending failure. The
    # decorated SpiceyPy method would consume that error ahead of our capture.
    libspice.chkout_c(b"surfpt_c")
    sp.check_for_spice_error(None)
    with sp.no_found_check():
        actual, found = sp.surfpt(position, direction, a, b, c)
    if bool(found) != bool(hit.value):
        raise AssertionError("Independent SURFPT found flags disagree")
    if found:
        for outer, inner in zip(actual, point, strict=True):
            if not (outer == inner or (math.isnan(outer) and math.isnan(inner))):
                raise AssertionError("Independent SURFPT outputs disagree")
    return actual, found


@contextmanager
def _trace(name):
    sp.chkin(name)
    try:
        yield
    finally:
        sp.chkout(name)


def _distortion(radii, plane):
    with _trace("inedpl_c"):
        point, first, second = sp.pl2psv(plane)
        if sp.vnorm(point) > max(radii):
            return
        inv = [1.0 / r for r in radii]
        sp.psv2pl(
            *(
                [value * k for value, k in zip(vec, inv, strict=True)]
                for vec in (point, first, second)
            )
        )


def edlimb(a, b, c, view):
    radii = (a, b, c)
    scale = max(radii)
    if min(radii) > 0:
        axes = [r / scale for r in radii]
        squares = [r * r for r in axes]
        if min(squares) > 0:
            v = sp.vscl(1.0 / scale, view)
            level = sum(x * x / s for x, s in zip(v, squares, strict=True))
            if not level < 1:
                with _trace("edlimb_c"):
                    plane = sp.nvc2pl(
                        [x / s for x, s in zip(v, squares, strict=True)], 1.0
                    )
                    _distortion(axes, plane)
    return sp.edlimb(a, b, c, view)


def npedln(a, b, c, point, direction):
    u, mag = sp.unorm(direction)
    scale = max(a, b, c)
    if mag == 0 or min(a, b, c) <= 0:
        return sp.npedln(a, b, c, point, direction)
    radii = [r / scale for r in (a, b, c)]
    squares = [r * r for r in radii]
    if min(squares) == 0:
        return sp.npedln(a, b, c, point, direction)
    p = [float(x) / scale for x in point]
    with _trace("npedln_c"):
        _, forward = surfpt(p, u, *radii)
        if not forward:
            _, back = surfpt(p, sp.vminus(u), *radii)
            if not back:
                plane = sp.nvc2pl([x / s for x, s in zip(u, squares, strict=True)], 0.0)
                _distortion(radii, plane)
                with sp.no_found_check():
                    ellipse, found = sp.inedpl(*radii, plane)
                if found:
                    proj = sp.nvc2pl(u, 0.0)
                    el = sp.pjelpl(ellipse, proj)
                    pp = sp.vprjp(p, proj)
                    center, major, minor = sp.el2cgv(el)
                    m, n = sp.vnorm(major), sp.vnorm(minor)
                    if m != 0 and n != 0:
                        inv = 1.0 / m
                        local = sp.vscl(inv, sp.vsub(pp, center))
                        if not all(math.isfinite(x) for x in [m, n, inv, *local]):
                            raise ValueError(
                                "npedln: projected nearest-point coordinates exceed finite workspace"
                            )
                    sp.npelpt(pp, el)
    return sp.npedln(a, b, c, point, direction)
