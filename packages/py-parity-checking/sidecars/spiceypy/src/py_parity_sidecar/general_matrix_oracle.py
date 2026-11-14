"""Rectangular row-major observations from the locked SpiceyPy toolkit."""

from __future__ import annotations

import ctypes as ct

import numpy as np
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice


# The ordinary wrappers infer positive shapes from nested matrices. Use the
# exact ABI when that representation loses a zero or negative dimension, and
# for MEQUG, whose 6.0.3 wrapper forwards its two dimensions in reverse order.
_lib = ct.CDLL(libspice._name)
_D, _I = ct.c_double, ct.c_int
_P = ct.POINTER(_D)
if ct.sizeof(_I) != 4 or ct.sizeof(_D) != 8:
    raise RuntimeError("Unsupported CSPICE matrix ABI")
for _name, _args in {
    "mequg": [_P, _I, _I, _P],
    "mtxmg": [_P, _P, _I, _I, _I, _P],
    "mtxvg": [_P, _P, _I, _I, _P],
    "mxmg": [_P, _P, _I, _I, _I, _P],
    "mxmtg": [_P, _P, _I, _I, _I, _P],
    "mxvg": [_P, _P, _I, _I, _P],
    "vtmvg": [_P, _P, _P, _I, _I],
    "xposeg": [_P, _I, _I, _P],
}.items():
    _function = getattr(_lib, _name + "_c")
    _function.argtypes = _args
    _function.restype = _D if _name == "vtmvg" else None

_LIMIT = 33_554_432  # 256 MiB of binary64


def _dimension(n: int, *, signed: bool = False) -> int:
    minimum = -(2**31) if signed else 0
    if type(n) is not int or not minimum <= n < 2**31:
        raise ValueError("Invalid matrix dimension")
    return n


def _extent(*shape: int) -> int:
    size = 1
    for dimension in shape:
        size *= dimension
    if size > _LIMIT:
        raise ValueError("Matrix extent exceeds the supported element limit")
    return size


def _arrays(*inputs: tuple[list[float], tuple[int, ...]]) -> list[np.ndarray]:
    # Check every shape before converting any operand or allocating output.
    for values, shape in inputs:
        if len(values) != _extent(*shape):
            raise ValueError("Input length does not match explicit matrix/vector dimensions")
    arrays = []
    for values, shape in inputs:
        data = np.asarray(values, dtype=np.float64)
        if data.ndim != 1 or not np.isfinite(data).all():
            raise ValueError("Matrix and vector inputs must be flat and finite")
        arrays.append(data.reshape(shape))
    return arrays


def _read(result: np.ndarray, *shape: int) -> list[float]:
    if result.shape != shape:
        raise AssertionError(f"Unexpected locked matrix result shape {result.shape}, expected {shape}")
    return result.ravel(order="C").tolist()


def _backed(a: np.ndarray) -> np.ndarray:
    # Non-null owned storage for each input, even when no element may be read.
    return a if a.size else np.array([37.25], dtype=np.float64)


def _direct(name: str, arrays: list[np.ndarray], dims: tuple[int, ...], size: int) -> list[float]:
    inputs = [_backed(a) for a in arrays]
    output = np.full(max(1, size), -873.125, dtype=np.float64)
    fn = getattr(_lib, name + "_c")
    fn(*(a.ctypes.data_as(_P) for a in inputs), *dims, output.ctypes.data_as(_P))
    sp.check_for_spice_error(None)
    if not size and output[0] != -873.125:
        raise AssertionError("Zero-sized matrix output touched its sentinel")
    return output[:size].tolist()


def mequg(m1: list[float], nr: int, nc: int) -> list[float]:
    _dimension(nr)
    _dimension(nc)
    m, = _arrays((m1, (nr, nc)))
    return _direct("mequg", [m], (nr, nc), m.size)


def xposeg(matrix: list[float], nrow: int, ncol: int) -> list[float]:
    _dimension(nrow, signed=True)
    _dimension(ncol, signed=True)
    m, = _arrays((matrix, (max(0, nrow), max(0, ncol))))
    if min(nrow, ncol) <= 0:
        return _direct("xposeg", [m], (nrow, ncol), 0)
    return _read(sp.xposeg(m), ncol, nrow)


def _matrix_product(name: str, m1: list[float], m2: list[float],
                    rows: int, inner: int, columns: int) -> list[float]:
    _dimension(rows)
    _dimension(inner, signed=name in ("mtxmg", "mxmg"))
    _dimension(columns)
    _extent(rows)  # The C outer loop visits each output row even when width is zero.
    out_size = _extent(rows, columns)
    n = max(0, inner)
    first_shape = (n, rows) if name == "mtxmg" else (rows, n)
    second_shape = (columns, n) if name == "mxmtg" else (n, columns)
    a, b = _arrays((m1, first_shape), (m2, second_shape))
    if min(rows, inner, columns) <= 0:
        return _direct(name, [a, b], (rows, inner, columns), out_size)
    return _read(getattr(sp, name)(a, b), rows, columns)


def mtxmg(m1: list[float], m2: list[float], nc1: int, nr1r2: int, nc2: int) -> list[float]:
    return _matrix_product("mtxmg", m1, m2, nc1, nr1r2, nc2)


def mxmg(m1: list[float], m2: list[float], nr1: int, nc1r2: int, nc2: int) -> list[float]:
    return _matrix_product("mxmg", m1, m2, nr1, nc1r2, nc2)


def mxmtg(m1: list[float], m2: list[float], nr1: int, nc1c2: int, nr2: int) -> list[float]:
    return _matrix_product("mxmtg", m1, m2, nr1, nc1c2, nr2)


def _matrix_vector(name: str, m1: list[float], v2: list[float], out: int, inner: int) -> list[float]:
    _dimension(out)
    _dimension(inner)
    _extent(out)
    shape = (inner, out) if name == "mtxvg" else (out, inner)
    a, v = _arrays((m1, shape), (v2, (inner,)))
    if min(out, inner) == 0:
        return _direct(name, [a, v], (out, inner), out)
    return _read(getattr(sp, name)(a, v), out)


def mtxvg(m1: list[float], v2: list[float], nc1: int, nr1r2: int) -> list[float]:
    return _matrix_vector("mtxvg", m1, v2, nc1, nr1r2)


def mxvg(m1: list[float], v2: list[float], nr1: int, nc1r2: int) -> list[float]:
    return _matrix_vector("mxvg", m1, v2, nr1, nc1r2)


def vtmvg(v1: list[float], matrix: list[float], v2: list[float], nrow: int, ncol: int) -> float:
    _dimension(nrow)
    _dimension(ncol)
    left, m, right = _arrays((v1, (nrow,)), (matrix, (nrow, ncol)), (v2, (ncol,)))
    if min(nrow, ncol) == 0:
        arrays = [_backed(a) for a in (left, m, right)]
        value = _lib.vtmvg_c(*(a.ctypes.data_as(_P) for a in arrays), nrow, ncol)
        sp.check_for_spice_error(None)
        return float(value)
    return float(sp.vtmvg(left, m, right))
