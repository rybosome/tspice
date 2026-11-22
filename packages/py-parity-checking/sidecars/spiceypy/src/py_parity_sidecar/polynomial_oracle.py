"""Bounds and a narrow locked-C route for polyds' negative-order no-op.

SpiceyPy 6.0.3 cannot return its negative-order zero-length output: at -1 its
converter raises IndexError; smaller orders fail allocating a negative length.
This binding calls the real locked symbol with valid sentinel storage and
verifies the documented no-write behavior. Nonnegative orders use SpiceyPy.
"""
from __future__ import annotations

import ctypes
import math
from collections.abc import Sequence

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

D = ctypes.c_double
I = ctypes.c_int
P = ctypes.POINTER(D)
_oracle = ctypes.CDLL(libspice._name)
_polyds = _oracle.polyds_c
_polyds.argtypes = [P, I, I, D, P]
_polyds.restype = None


def finite(value: float) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Polynomial inputs must be finite numbers")


def coefficients(values: Sequence[float], *, allow_empty: bool) -> None:
    if len(values) > 2147483647:
        raise ValueError("Coefficient count exceeds signed32 bound")
    if not allow_empty and not values:
        raise ValueError("This Chebyshev operation requires coefficients")
    for value in values:
        finite(value)


def derivative_order(order: int, *, chebyshev: bool) -> None:
    lower, upper = (0, 715827881) if chebyshev else (-2147483648, 2147483646)
    if isinstance(order, bool) or not isinstance(order, int) or not lower <= order <= upper:
        raise ValueError("Derivative order exceeds this routine's safe integer bounds")


def chebyshev_inputs(cp: Sequence[float], x2s: Sequence[float], x: float, *, integral: bool = False) -> None:
    coefficients(cp, allow_empty=integral)
    if len(x2s) != 2:
        raise ValueError("Transformation must contain exactly two numbers")
    for value in x2s:
        finite(value)
    finite(x)
    # Actual CHBIGR owns INVALIDDEGREE/INVALIDRADIUS; error-free evaluators
    # receive their exact transformation unchanged. Cases honor their domain.


def polyds(coeffs: Sequence[float], nderiv: int, t: float) -> list[float]:
    coefficients(coeffs, allow_empty=True)
    derivative_order(nderiv, chebyshev=False)
    finite(t)
    degree = len(coeffs) - 1
    if nderiv >= 0:
        # Empty coefficients infer degree -1, which never reads this dummy.
        values = sp.polyds(coeffs if coeffs else [0.0], degree, nderiv, t)
        return [float(value) for value in values]
    # Negative order returns before reading coefficients or writing outputs.
    # Both pointers address valid objects, with a preceding sentinel too.
    source = (D * 2)(101.25, -202.5)
    output = (D * 2)(303.75, -404.125)
    source_ptr = ctypes.cast(ctypes.byref(source, ctypes.sizeof(D)), P)
    output_ptr = ctypes.cast(ctypes.byref(output, ctypes.sizeof(D)), P)
    _polyds(source_ptr, I(degree), I(nderiv), D(t), output_ptr)
    sp.check_for_spice_error(None)
    if list(source) != [101.25, -202.5] or list(output) != [303.75, -404.125]:
        raise AssertionError("Negative-order polyds touched sentinel storage")
    return []
