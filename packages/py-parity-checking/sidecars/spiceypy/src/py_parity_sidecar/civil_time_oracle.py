"""Civil calendar text and independently checked local solar time observations."""
from __future__ import annotations

import ctypes as ct
import math
import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

_lib = ct.CDLL(libspice._name)
_calendar = _lib.etcal_c
_calendar.argtypes = [ct.c_double, ct.c_int, ct.POINTER(ct.c_char)]
_calendar.restype = None
_solar = _lib.et2lst_c
_solar.argtypes = [ct.c_double, ct.c_int, ct.c_double, ct.c_char_p, ct.c_int, ct.c_int,
                   ct.POINTER(ct.c_int), ct.POINTER(ct.c_int), ct.POINTER(ct.c_int),
                   ct.POINTER(ct.c_char), ct.POINTER(ct.c_char)]
_solar.restype = None


# Use the same pinned library's parser to identify numeric fields without
# evaluating calendar arithmetic. The oracle runs the public routine only for
# bounded calendar fields and leap tables; guard-only tests exercise tspice.
_char = ct.POINTER(ct.c_char)
_integer = ct.POINTER(ct.c_int)
_vector = ct.POINTER(ct.c_double)
_parse = _lib.tpartv_
_parse.argtypes = [ct.c_char_p, _vector, _integer, _char, _char, _integer, _integer,
                   _integer, _char, _char, ct.c_int, ct.c_int, ct.c_int, ct.c_int, ct.c_int]
_parse.restype = ct.c_int
_expand = _lib.texpyr_
_expand.argtypes = [_integer]
_expand.restype = ct.c_int


def utc_et(text: str) -> float:
    data = text.encode("utf-8")
    if b"\0" in data or len(data) > 2**31 - 1:
        raise ValueError("UTC input exceeds the independent oracle's string domain")
    if not data:
        return float(sp.utc2et(text))
    fields = (ct.c_double * 10)()
    count, mods, abbreviated, success = (ct.c_int() for _ in range(4))
    typ, modifiers, picture, message = (ct.create_string_buffer(n) for n in (8, 40, 80, 480))
    _parse(data, fields, ct.byref(count), typ, modifiers, ct.byref(mods),
           ct.byref(abbreviated), ct.byref(success), picture, message, len(data), 8, 8, 80, 480)
    sp.check_for_spice_error(None)
    if success.value:
        if typ.raw.strip() == b"JD":
            bounded = math.isfinite(fields[0]) and abs(fields[0]) <= 10**7
        else:
            bounded = all(math.isfinite(v) and abs(v) <= 10000 for v in fields)
            if bounded and typ.raw.strip() in (b"YMD", b"YD") and abbreviated.value:
                year = ct.c_int(round(fields[0]))
                _expand(ct.byref(year))
                bounded = abs(year.value) <= 10000
        if not bounded:
            raise ValueError("UTC fields exceed the independent oracle's checked date range")
        with sp.no_found_check():
            table, found = sp.gdpool("DELTET/DELTA_AT", 0, 280)
        if found and (len(table) % 2 or any(not math.isfinite(v) for v in table)
                      or any(abs(v) > 10000 for v in table[::2])
                      or any(abs(v) > 10**12 for v in table[1::2])):
            raise ValueError("leap table exceeds the independent UTC oracle's checked range")
    return float(sp.utc2et(text))


def check_body_codes() -> None:
    # ZZBODKER consumes paired name/code arrays when it rebuilds its name hash.
    with sp.no_found_check():
        names, name_type, have_names = sp.dtpool("NAIF_BODY_NAME")
        codes, code_type, have_codes = sp.dtpool("NAIF_BODY_CODE")
        if not (have_names and have_codes and name_type == "C" and code_type == "N"
                and names == codes and 0 < codes <= 14983):
            return
        values, _ = sp.gdpool("NAIF_BODY_CODE", 0, codes)
    if any(not -(2**31) <= v <= 2**31 - 1 for v in values):
        return  # GIPOOL reports the conversion error before the hash is built.
    if any(v <= -(2**31) + 0.5 for v in values):
        raise ValueError("body mappings exceed the independent oracle's signed hash range")


def calendar(et: float, capacity: int) -> str:
    if not math.isfinite(et) or not -(2**31) <= capacity < 2**31:
        raise ValueError("calendar requires finite ET and a signed integer capacity")
    capacity = min(capacity, 181)
    text = ct.create_string_buffer(max(capacity, 1))
    _calendar(et, capacity, text)
    sp.check_for_spice_error(None)
    return text.value.decode("ascii")


def solar_time(et: float, body: int, lon: float, kind: str, timlen: int, ampmlen: int):
    # N0067 ET2LST can continue with a private intermediate after a failed
    # PGRREC or SPKEZ. Check those exact operations, without a tspice shim.
    if not all(-(2**31) <= n < 2**31 for n in (body, timlen, ampmlen)):
        raise ValueError("solar time integer exceeds signed SpiceInt")
    if not math.isfinite(et) or not math.isfinite(lon) or "\0" in kind:
        raise ValueError("solar time expects finite coordinates and NUL-free text")
    typ = kind.encode("utf-8").lstrip(b" ")[:32].rstrip(b" ").upper()
    if min(timlen, ampmlen) >= 2 and typ in (b"PLANETOGRAPHIC", b"PLANETOCENTRIC"):
        if body == -(2**31):
            raise ValueError("body code exceeds defined CSPICE hash range")
        if typ == b"PLANETOGRAPHIC" or body != 10:
            check_body_codes()
        if typ == b"PLANETOGRAPHIC":
            with sp.no_found_check():
                name, found = sp.bodc2n(body)
            sp.pgrrec(name if found else str(body), lon, 0, 0, 1, 0)
        if body != 10:
            with sp.no_found_check():
                _, name, found = sp.cidfrm(body)
            if found:
                state, _ = sp.spkez(10, et, name, "LT+S", body)
                if (not all(math.isfinite(v) for v in state[:3])
                        or (typ == b"PLANETOCENTRIC" and abs(lon) > 1e12)):
                    raise ValueError("solar longitude exceeds the independent clock oracle range")
    cap1, cap2 = min(timlen, 9), min(ampmlen, 14)
    time = ct.create_string_buffer(max(1, cap1))
    ampm = ct.create_string_buffer(max(1, cap2))
    hr, mn, sc = ct.c_int(), ct.c_int(), ct.c_int()
    _solar(et, body, lon, kind.encode("utf-8"), cap1, cap2,
           ct.byref(hr), ct.byref(mn), ct.byref(sc), time, ampm)
    sp.check_for_spice_error(None)
    return dict(hr=hr.value, mn=mn.value, sc=sc.value, time=time.value.decode("ascii"),
                ampm=ampm.value.decode("ascii"))
