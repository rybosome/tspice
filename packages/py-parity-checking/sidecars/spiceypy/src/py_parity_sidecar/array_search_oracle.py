"""Check input storage and ordering before passing authored cases to locked SpiceyPy."""
from __future__ import annotations

import math
from collections.abc import Sequence

from .sorted_bounds_oracle import _utf8

# The C searches add two signed binary-search indices, and each native/wasm
# input is bounded to the repository's 256 MiB buffer budget.
_BUFFER_BYTES = 256 * 1024 * 1024


def _indices(n: int, order: list[int] | None) -> Sequence[int]:
    if order is None:
        return range(n)
    if (len(order) != n or any(type(i) is not int or not 0 <= i < n for i in order)
            or len(set(order)) != n):
        raise ValueError("An order vector must be a permutation of the physical indices")
    return order


def numeric(key: int | float, values: list[int] | list[float], *,
            order: list[int] | None, binary: bool, integer: bool) -> None:
    n = len(values)
    if n > _BUFFER_BYTES // (4 if integer else 8):
        raise ValueError("Numeric search operand exceeds the supported buffer")
    indices = _indices(n, order)

    def validate(value: int | float) -> None:
        if integer:
            if type(value) is not int or not -2147483648 <= value <= 2147483647:
                raise ValueError("Expected a signed SpiceInt")
        elif type(value) not in (int, float) or (binary and math.isnan(value)):
            raise ValueError("Expected a double in the search domain")

    validate(key)
    previous = None
    for i in indices:
        value = values[i]
        validate(value)
        if binary and previous is not None and previous > value:
            raise ValueError("Binary search needs nondecreasing input in search order")
        previous = value


def character_width(key: str, values: list[str], *,
                    order: list[int] | None, binary: bool) -> int:
    n = len(values)
    if n > _BUFFER_BYTES // 2 or (order is not None and n > _BUFFER_BYTES // 4):
        raise ValueError("Character search operand exceeds the supported buffer")
    indices = _indices(n, order)
    if len(_utf8(key)) + 1 > _BUFFER_BYTES:
        raise ValueError("Search key exceeds the supported buffer")
    encoded = [_utf8(row) for row in values]
    width = max(2, 1 + max((len(row) for row in encoded), default=0))
    if n * width > _BUFFER_BYTES:
        raise ValueError("Rectangular character block exceeds the supported buffer")
    if binary:
        previous = None
        for i in indices:
            # Fortran orders byte strings as though the shorter were extended
            # with ASCII spaces. Keep physical input rows unchanged for CSPICE.
            row = encoded[i].ljust(width - 1, b" ")
            if previous is not None and previous > row:
                raise ValueError("Binary search needs nondecreasing blank-extended strings")
            previous = row
    return width
