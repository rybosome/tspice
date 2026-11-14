"""Complete outputs from canonical symbols in the locked SpiceyPy library."""
import ctypes as c
import math
import re

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from .string_oracle import _signed32, _text_bytes, single_byte

lib = c.CDLL(libspice._name)
ip, dp, chars = c.POINTER(c.c_int), c.POINTER(c.c_double), c.POINTER(c.c_char)
lib.dp2hx_c.argtypes = [c.c_double, c.c_int, chars, ip]
lib.dp2hx_c.restype = None
lib.hx2dp_c.argtypes = [c.c_char_p, c.c_int, dp, ip, chars]
lib.hx2dp_c.restype = None
lib.repmc_c.argtypes = [c.c_char_p, c.c_char_p, c.c_char_p, c.c_int, chars]
lib.repmc_c.restype = None
lib.repmct_c.argtypes = [c.c_char_p, c.c_char_p, c.c_int, c.c_char, c.c_int, chars]
lib.repmct_c.restype = None
lib.repmd_c.argtypes = [c.c_char_p, c.c_char_p, c.c_double, c.c_int, c.c_int, chars]
lib.repmd_c.restype = None
lib.repmf_c.argtypes = [c.c_char_p, c.c_char_p, c.c_double, c.c_int, c.c_char, c.c_int, chars]
lib.repmf_c.restype = None
lib.repmi_c.argtypes = [c.c_char_p, c.c_char_p, c.c_int, c.c_int, chars]
lib.repmi_c.restype = None
lib.repml_c.argtypes = [c.c_char_p, c.c_char_p, c.c_int, c.c_char, c.c_int, chars]
lib.repml_c.restype = None
lib.repmot_c.argtypes = [c.c_char_p, c.c_char_p, c.c_int, c.c_char, c.c_int, chars]
lib.repmot_c.restype = None

def _finite(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("Expected a finite double")
    return value


def _storage(bound: int, requested: int | None):
    capacity = bound if requested is None else min(_signed32(requested), bound)
    return capacity, c.create_string_buffer(max(1, capacity))


def dp2hx(value: float, lenout: int | None) -> dict:
    length, text = _storage(256, lenout)
    size = c.c_int()
    lib.dp2hx_c(_finite(value), length, text, c.byref(size))
    sp.check_for_spice_error(None)
    return {"hxstr": text.value.decode(), "hxssiz": size.value}


def hx2dp(input: str, lenout: int | None) -> dict:
    data = _text_bytes(input)
    # The production extreme loop-bound equivalence is exercised by comparing
    # those public requests to independently chosen safe canonical exponents.
    # Never forward these exceptional large valid integers to the locked C loop.
    match = re.fullmatch(rb" *[+-]?[0-9a-fA-F]{0,31}\^ *([+-]?)([0-9a-fA-F]+) *", data)
    if match:
        exp = int((match[1] + match[2]).decode(), 16)
        if -2147483648 <= exp <= 2147483647 and abs(exp) > 1024:
            raise ValueError("Independent HX2DP requires a bounded scaling exponent")
    length, message = _storage(193, lenout)
    value, error = c.c_double(42.5), c.c_int()
    lib.hx2dp_c(data, length, c.byref(value), c.byref(error), message)
    sp.check_for_spice_error(None)
    result = {"error": bool(error.value), "errmsg": message.value.decode()}
    if error.value:
        if value.value != 42.5:
            raise RuntimeError("HX2DP changed the caller number on failure")
    else:
        result["number"] = value.value
    return result


def prsdp(input: str) -> float:
    _text_bytes(input)
    return sp.prsdp(input)


def prsint(input: str) -> int:
    _text_bytes(input)
    return sp.prsint(input)


def repmc(input: str, marker: str, value: str, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + max(1, len(_text_bytes(value))) + 1, lenout)
    lib.repmc_c(data, mark, _text_bytes(value), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repmct(input: str, marker: str, value: int, rtcase: str, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 145 + 1, lenout)
    if value == -2147483648 and data and length >= 2 and rtcase in "UuLlCc" and mark.strip(b" ") and mark.strip(b" ") in data:
        raise ValueError("N0067 integer word conversion cannot negate INT32_MIN")
    lib.repmct_c(data, mark, _signed32(value), single_byte(rtcase), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repmd(input: str, marker: str, value: float, sigdig: int, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 23 + 1, lenout)
    lib.repmd_c(data, mark, _finite(value), _signed32(sigdig), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repmf(input: str, marker: str, value: float, sigdig: int, format: str, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 56 + 1, lenout)
    lib.repmf_c(data, mark, _finite(value), _signed32(sigdig), single_byte(format), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repmi(input: str, marker: str, value: int, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 11 + 1, lenout)
    lib.repmi_c(data, mark, _signed32(value), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repml(input: str, marker: str, value: bool, rtcase: str, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 5 + 1, lenout)
    if type(value) is not bool:
        raise ValueError("Expected a boolean")
    lib.repml_c(data, mark, int(value), single_byte(rtcase), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()


def repmot(input: str, marker: str, value: int, rtcase: str, lenout: int | None) -> str:
    data, mark = _text_bytes(input), _text_bytes(marker)
    length, text = _storage(len(data) + 147 + 1, lenout)
    if value == -2147483648 and data and length >= 2 and rtcase in "UuLlCc" and mark.strip(b" ") and mark.strip(b" ") in data:
        raise ValueError("N0067 integer word conversion cannot negate INT32_MIN")
    lib.repmot_c(data, mark, _signed32(value), single_byte(rtcase), length, text)
    sp.check_for_spice_error(None)
    return text.value.decode()
