"""Validate actual locked-wrapper array/count contracts before CSPICE calls.

These limits follow pinned C byte counts and unreduced f2c index arithmetic.
Zero-node interpolation remains an actual INVALIDSIZE call. QDERIV's empty
input is explicitly unsupported by its primary contract and is rejected here.
"""
from __future__ import annotations

import math
from collections.abc import Sequence

POINT_LIMITS = {"hrmesp": 67108863, "hrmint": 357913941, "lgresp": 268435455, "lgrind": 715827882, "lgrint": 268435455, "qderiv": 2147483646}


def finite(value: float) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Interpolation inputs must be finite numbers")


def point_count(routine: str, count: int) -> None:
    if count > POINT_LIMITS[routine] or (routine == "qderiv" and count == 0):
        raise ValueError("Interpolation count exceeds the safe C domain")


def equally_spaced(routine: str, first: float, step: float, yvals: Sequence[float], x: float) -> None:
    stride = 2 if routine == "hrmesp" else 1
    if len(yvals) % stride:
        raise ValueError("Hermite ordinates require complete value/derivative pairs")
    point_count(routine, len(yvals) // stride)
    for value in (first, step, x):
        finite(value)
    for value in yvals:
        finite(value)


def arbitrary(routine: str, xvals: Sequence[float], yvals: Sequence[float], x: float) -> None:
    point_count(routine, len(xvals))
    stride = 2 if routine == "hrmint" else 1
    if len(yvals) != stride * len(xvals):
        raise ValueError("Interpolation input lengths do not match")
    finite(x)
    for vector in (xvals, yvals):
        for value in vector:
            finite(value)
    # Duplicate abscissas and empty tables reach actual CSPICE diagnostics.


def quadratic(f0: Sequence[float], f2: Sequence[float], delta: float) -> None:
    point_count("qderiv", len(f0))
    point_count("qderiv", len(f2))
    if len(f0) != len(f2):
        raise ValueError("QDERIV endpoint dimensions must match")
    finite(delta)
    for vector in (f0, f2):
        for value in vector:
            finite(value)
    # A zero delta is a genuine SPICE(DIVIDEBYZERO), not a fabricated guard.
