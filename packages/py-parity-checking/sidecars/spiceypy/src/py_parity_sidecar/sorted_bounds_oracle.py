"""Validate the documented sorted-input domain and marshal fixed-width rows.

Every search is performed by the actual locked SpiceyPy wrapper in the domain
handler. This module never computes a search result.
"""
from __future__ import annotations

import math


def _count(n: int) -> None:
    if not 0 <= n <= 2147483647:
        raise ValueError("Search count must fit signed 32-bit storage")


def numeric(key: int | float, values: list[int] | list[float], *, integer: bool) -> None:
    _count(len(values))

    def validate(item: int | float) -> None:
        if integer:
            if type(item) is not int or not -2147483648 <= item <= 2147483647:
                raise ValueError("Expected a signed 32-bit search number")
        elif type(item) not in (int, float) or math.isnan(item):
            raise ValueError("Expected an ordered double")

    validate(key)
    previous = None
    for value in values:
        validate(value)
        if previous is not None and value < previous:
            raise ValueError("Sorted search inputs must be non-decreasing")
        previous = value


def _utf8(value: str) -> bytes:
    if not isinstance(value, str) or "\x00" in value:
        raise ValueError("Expected text without embedded NUL")
    data = value.encode("utf-8", errors="strict")
    _count(len(data) + 1)
    return data


def character_rows(key: str, values: list[str]) -> tuple[int, list[str]]:
    _count(len(values))
    _utf8(key)
    encoded = [_utf8(value) for value in values]
    width = max(2, 1 + max((len(row) for row in encoded), default=0))
    _count(len(values) * width)
    # LSTLEC uses arrlen-1 for its interior comparisons. Explicit blank
    # padding makes every row agree with the toolkit's Fortran comparator.
    previous = None
    rows = []
    for text, data in zip(values, encoded, strict=True):
        padding = width - 1 - len(data)
        row = data + b" " * padding
        if previous is not None and row < previous:
            raise ValueError("Search rows must be in unsigned blank-padded byte order")
        rows.append(text + " " * padding)
        previous = row
    return width, rows
