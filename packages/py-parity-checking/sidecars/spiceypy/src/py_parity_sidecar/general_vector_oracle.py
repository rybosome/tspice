"""Independent dimension-zero route around SpiceyPy 6.0.3's output converter.

Its vector-returning wrappers invoke the right C routines but raise IndexError
while converting a zero-length ctypes array. Only zero-dimensional vector
outputs use these bindings. Non-empty calls use the reviewed SpiceyPy wrappers.
Every zero-dimensional result still executes its actual locked-library symbol.
"""
from __future__ import annotations

import ctypes
import math
from collections.abc import Sequence
from typing import Literal, overload

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

D = ctypes.c_double
I = ctypes.c_int
P = ctypes.POINTER(D)
_oracle = ctypes.CDLL(libspice._name)
_signatures = {
    "vaddg": [P, P, I, P],
    "vequg": [P, I, P],
    "vhatg": [P, I, P],
    "vlcomg": [I, D, P, D, P, P],
    "vminug": [P, I, P],
    "vprojg": [P, P, I, P],
    "vsclg": [D, P, I, P],
    "vsubg": [P, P, I, P],
    "unormg": [P, I, P, P],
}
for _name, _arguments in _signatures.items():
    _function = getattr(_oracle, _name + "_c")
    _function.argtypes = _arguments
    _function.restype = None


def validate_scalar(value: float) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("General vector coefficient must be a finite number")


def validate_inputs(routine: str, *vectors: Sequence[float]) -> None:
    limit = 2147483646 if routine in ("vprojg", "unormg") else 2147483647
    for vector in vectors:
        if len(vector) > limit:
            raise ValueError("General vector dimension exceeds this routine's safe signed32 count")
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in vector):
            raise ValueError("General vector components must be finite numbers")
    if vectors and any(len(vector) != len(vectors[0]) for vector in vectors[1:]):
        raise ValueError("General vector dimensions must match before calling CSPICE")


VectorRoutine = Literal["vaddg", "vequg", "vhatg", "vlcomg", "vminug", "vprojg", "vsclg", "vsubg"]


@overload
def empty_result(routine: VectorRoutine, *, a: float = 0, b: float = 0, s: float = 0) -> list[float]: ...


@overload
def empty_result(routine: Literal["unormg"], *, a: float = 0, b: float = 0, s: float = 0) -> tuple[list[float], float]: ...


def empty_result(routine: VectorRoutine | Literal["unormg"], *, a: float = 0, b: float = 0, s: float = 0) -> list[float] | tuple[list[float], float]:
    for coefficient in (a, b, s):
        validate_scalar(coefficient)
    if routine not in _signatures:
        raise ValueError("Unsupported empty general-vector binding")
    # Keep a guard element before each pointer as well as valid dummy storage.
    # This avoids NULL and supports translated Fortran pointer adjustments.
    first = (D * 2)(101.25, -202.5)
    second = (D * 2)(303.75, -404.125)
    output = (D * 2)(505.5, -606.25)
    first_ptr = ctypes.cast(ctypes.byref(first, ctypes.sizeof(D)), P)
    second_ptr = ctypes.cast(ctypes.byref(second, ctypes.sizeof(D)), P)
    output_ptr = ctypes.cast(ctypes.byref(output, ctypes.sizeof(D)), P)
    norm = D(-707.5)
    function = getattr(_oracle, routine + "_c")
    if routine in ("vaddg", "vprojg", "vsubg"):
        function(first_ptr, second_ptr, I(0), output_ptr)
    elif routine == "vlcomg":
        function(I(0), D(a), first_ptr, D(b), second_ptr, output_ptr)
    elif routine == "vsclg":
        function(D(s), first_ptr, I(0), output_ptr)
    elif routine == "unormg":
        function(first_ptr, I(0), output_ptr, ctypes.byref(norm))
    else:
        function(first_ptr, I(0), output_ptr)
    sp.check_for_spice_error(None)
    if list(first) != [101.25, -202.5] or list(second) != [303.75, -404.125] or list(output) != [505.5, -606.25]:
        raise AssertionError("A zero-dimensional CSPICE call touched vector storage")
    if routine == "unormg":
        return [], float(norm.value)
    return []
