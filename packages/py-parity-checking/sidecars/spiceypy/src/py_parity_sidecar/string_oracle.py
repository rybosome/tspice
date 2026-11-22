"""Exact string results from the independent library loaded by locked SpiceyPy.

SpiceyPy 6.0.3 strips trailing whitespace and discards malformed UTF-8
in all three string-result wrappers. Read the canonical C outputs directly.
"""
from __future__ import annotations

import ctypes
from collections.abc import Callable, Sequence

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_library = ctypes.CDLL(libspice._name)
_output_pointer = ctypes.POINTER(ctypes.c_char)
_cmprss = _library.cmprss_c
_cmprss.argtypes = [ctypes.c_char, ctypes.c_int, ctypes.c_char_p, ctypes.c_int, _output_pointer]
_cmprss.restype = None
_lcase = _library.lcase_c
_ucase = _library.ucase_c
for _fn in (_lcase, _ucase):
    _fn.argtypes = [ctypes.c_char_p, ctypes.c_int, _output_pointer]
    _fn.restype = None


def _text_bytes(value: str) -> bytes:
    if not isinstance(value, str) or "\0" in value:
        raise ValueError("Expected text without an embedded NUL")
    if len(value) >= 2147483647:
        raise ValueError("C string and terminator must fit a signed 32-bit length")
    data = value.encode("utf-8", errors="strict")
    if len(data) >= 2147483647:
        raise ValueError("C string and terminator must fit a signed 32-bit length")
    return data


def validate_text(*values: str) -> None:
    for value in values:
        _text_bytes(value)


def single_byte(value: str) -> bytes:
    if not isinstance(value, str) or len(value) != 1:
        raise ValueError("Expected one ASCII SpiceChar")
    return value.encode("ascii", errors="strict")


def _signed32(value: int) -> int:
    if type(value) is not int or not -2147483648 <= value <= 2147483647:
        raise ValueError("Expected a signed 32-bit integer")
    return value


def _output(data: bytes, lenout: int | None, minimum: int):
    # These three transformations never grow their input. Cap the actual C
    # capacity at sufficient storage, and retain invalid lengths to get the
    # real toolkit diagnostic with a non-null dummy buffer.
    full = max(minimum, len(data) + 1)
    _signed32(full)
    capacity = full if lenout is None else min(_signed32(lenout), full)
    storage = ctypes.create_string_buffer(max(1, capacity))
    return capacity, storage


def _result(storage) -> bytes:
    sp.check_for_spice_error(None)
    return storage.value


def compressed_bytes(delim: str, n: int, text: str, lenout: int | None) -> bytes:
    data = _text_bytes(text)
    capacity, storage = _output(data, lenout, 1)
    _cmprss(single_byte(delim), _signed32(n), data, capacity, storage)
    return _result(storage)


def case_bytes(text: str, lenout: int | None, *, upper: bool) -> bytes:
    data = _text_bytes(text)
    capacity, storage = _output(data, lenout, 2)
    (_ucase if upper else _lcase)(data, capacity, storage)
    return _result(storage)


def cmprss(delim: str, n: int, text: str, lenout: int | None) -> str:
    return compressed_bytes(delim, n, text, lenout).decode("utf-8", errors="strict")


def lcase(text: str, lenout: int | None) -> str:
    return case_bytes(text, lenout, upper=False).decode("utf-8", errors="strict")


def ucase(text: str, lenout: int | None) -> str:
    return case_bytes(text, lenout, upper=True).decode("utf-8", errors="strict")


def search(routine: Callable[[str, str, int], int], text: str, needle: str, start: int) -> int:
    validate_text(text, needle)
    _signed32(start)
    # All six C wrappers add one to start before entering SPICELIB. The
    # raw adapter's INT_MAX compatibility case is tested separately using
    # the equivalent safe canonical INT_MAX-1 result.
    if start == 2147483647:
        raise ValueError("Canonical one-based start must fit a signed 32-bit integer")
    return routine(text, needle, start)


_esrchc = _library.esrchc_c
_esrchc.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
_esrchc.restype = ctypes.c_int


def esrchc(value: str, values: Sequence[str]) -> int:
    key = _text_bytes(value)
    count = len(values)
    if count > 2147483647 // 2:
        raise ValueError("C row table exceeds signed 32-bit offsets")
    rows = [_text_bytes(row) for row in values]
    width = max(2, max(map(len, rows), default=0) + 1)
    if count * width > 2147483647:
        raise ValueError("C row table exceeds signed 32-bit offsets")
    # SpiceyPy 6.0.3 computes max() on empty input, stride 1 for all-empty
    # input, and character counts for UTF-8 rows. Supply actual terminated
    # byte rows through the pinned library, including storage at count zero.
    storage = ctypes.create_string_buffer(max(1, count * width))
    for i, row in enumerate(rows):
        storage[i * width : i * width + len(row)] = row
    found = _esrchc(key, count, width, storage)
    sp.check_for_spice_error(None)
    if rows and all(row.isascii() for row in rows) and any(rows):
        ordinary = sp.esrchc(value, values)
        if ordinary != found:
            raise AssertionError("Locked ESRCHC wrapper and C row lookup disagree")
    return found
