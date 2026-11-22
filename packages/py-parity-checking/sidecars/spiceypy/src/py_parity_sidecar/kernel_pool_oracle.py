"""Observe N0067 through the locked SpiceyPy library, including exact C string bytes."""
import ctypes as c

import spiceypy as sp

# Give only these independent bindings their C signatures. Leave SpiceyPy's
# ctypes wrappers and its shared error/found handling untouched.
_lib = c.CDLL(sp.libspice._name)
_intptr = c.POINTER(c.c_int)
for _name, _args in {
    "bodvcd": [c.c_int, c.c_char_p, c.c_int, _intptr, c.POINTER(c.c_double)],
    "bodvrd": [c.c_char_p, c.c_char_p, c.c_int, _intptr, c.POINTER(c.c_double)],
    "lmpool": [c.c_void_p, c.c_int, c.c_int],
    "gcpool": [c.c_char_p, c.c_int, c.c_int, c.c_int, _intptr, c.c_void_p, _intptr],
    "stpool": [c.c_char_p, c.c_int, c.c_char_p, c.c_int, c.c_void_p, _intptr, _intptr],
}.items():
    _fn = getattr(_lib, _name + "_c")
    _fn.argtypes = _args
    _fn.restype = None


def spice_int(value: int) -> int:
    if not -(2**31) <= value < 2**31:
        raise ValueError("expected signed 32-bit integer")
    return value


def input_text(value: str) -> str:
    if "\x00" in value or len(value.encode("utf-8")) >= 2**31:
        raise ValueError("invalid C string")
    return value


def _body_table_guard() -> None:
    # ZZBODKER can hash all installed name/code pairs when resolving a name.
    # Only the signed minimum cannot participate in the pinned hash. GIPOOL
    # checks its entire numeric input's range before ZZBODINI is entered.
    with sp.no_found_check():
        nn, tn, fn = sp.dtpool("NAIF_BODY_NAME")
        nc, tc, fc = sp.dtpool("NAIF_BODY_CODE")
        if not (fn and fc and tn == "C" and tc == "N" and 0 < nn == nc <= 14983):
            return
        codes, _ = sp.gdpool("NAIF_BODY_CODE", 0, nc)
    if not all(-(2**31) <= code <= 2**31 - 1 for code in codes):
        return
    if not any(-(2**31) <= code <= -(2**31) + 0.5 for code in codes):
        return
    # ZZBODKER checks the original 36-byte Fortran names for blanks before
    # building the signed-code hash. Preserve that earlier toolkit diagnostic.
    for start in range(0, nn, 32):
        count, found = c.c_int(), c.c_int()
        width = 37
        rows = c.create_string_buffer(32 * width)
        _lib.gcpool_c(b"NAIF_BODY_NAME", start, 32, width, c.byref(count), rows, c.byref(found))
        sp.check_for_spice_error(None)
        for i in range(count.value):
            if not rows[i * width : (i + 1) * width].split(b"\x00", 1)[0].strip(b" "):
                return
    raise ValueError("body mapping contains a code outside the supported hash domain")


def body_values(body: int | str, item: str, maxn: int) -> dict:
    item = input_text(item)
    capacity = min(spice_int(maxn), 400000)  # N0067 SZPOOL('MAXVAL')
    is_name = isinstance(body, str)
    if is_name:
        input_text(body)
        if body and item:
            _body_table_guard()
    else:
        spice_int(body)
    if capacity > 0:
        # The high-level wrappers return the entire preallocated array. Only
        # the first dim entries are valid; retain both the count and that slice.
        fn = sp.bodvrd if is_name else sp.bodvcd
        dim, values = fn(body, item, capacity)
    else:
        # The wrapper tries to construct/convert a nonpositive-size NumPy
        # vector before its decorator can raise and reset the scientific error.
        dim_out, values = c.c_int(), (c.c_double * 1)()
        if is_name:
            _lib.bodvrd_c(body.encode(), item.encode(), capacity, c.byref(dim_out), values)
        else:
            _lib.bodvcd_c(body, item.encode(), capacity, c.byref(dim_out), values)
        sp.check_for_spice_error(None)
        dim = dim_out.value
    if not 0 <= dim <= capacity:
        raise ValueError("invalid returned body variable extent")
    return {"dim": dim, "values": [float(v) for v in values[:dim]]}


def load_lines(lines: list[str]) -> None:
    if len(lines) >= 2**31:
        raise ValueError("too many text rows")
    rows = [input_text(line).encode() for line in lines]
    width = max(2, max(map(len, rows), default=0) + 1)
    if width * len(rows) > 2**31 - 1:
        raise ValueError("text kernel row table exceeds signed indexing")
    if rows and any(rows) and all(row.isascii() for row in rows):
        sp.lmpool(lines)
        return
    # The locked wrapper computes max() of character counts, which cannot
    # represent zero rows, the minimum width for all-empty rows, or UTF-8 byte widths.
    storage = c.create_string_buffer(max(1, width * len(rows)))
    for i, row in enumerate(rows):
        storage[i * width : i * width + len(row)] = row
    _lib.lmpool_c(storage, width, len(rows))
    sp.check_for_spice_error(None)


def _check_continuation_domain(item: bytes, nth: int, marker: bytes) -> None:
    # Inspect only components the requested lookup would scan. STPOOL's
    # two loops form an invalid pointer when cfirst == 0. Its RTRIM keeps
    # one byte even for all blanks. GCPOOL returns only the significant bytes.
    marker = marker.rstrip(b" ") or b" "
    if len(marker) == 1 or len(marker) > 81:
        return
    start = 0
    complete = 0
    room, width = 32, 81
    rows = c.create_string_buffer(room * width)
    while True:
        count, found = c.c_int(), c.c_int()
        _lib.gcpool_c(item, start, room, width, c.byref(count), rows, c.byref(found))
        sp.check_for_spice_error(None)
        if not found.value or not count.value:
            return
        for i in range(count.value):
            row = rows[i * width : (i + 1) * width].split(b"\x00", 1)[0].rstrip(b" ") or b" "
            if len(marker) == len(row) + 1:
                raise ValueError("unsupported continuation marker/component length boundary")
            if not row.endswith(marker):
                complete += 1
                if complete > nth:
                    return
        start += count.value


def pool_string(item: str, nth: int, contin: str, lenout: int) -> dict:
    item_bytes = input_text(item).encode()
    marker = input_text(contin).encode()
    nth = spice_int(nth)
    if nth == 2**31 - 1:
        raise ValueError("oracle cannot forward this ordinal through N0067's nth+1")
    # A logical string cannot exceed the entire pool's 15000 character
    # components at 80 bytes each. Invalid sizes still reach the toolkit.
    capacity = min(spice_int(lenout), 15000 * 80 + 1)
    if item_bytes and marker and nth >= 0 and capacity >= 2:
        _check_continuation_domain(item_bytes, nth, marker)
    output = c.create_string_buffer(max(1, capacity))
    size, found = c.c_int(), c.c_int()
    _lib.stpool_c(item_bytes, nth, marker, capacity, output, c.byref(size), c.byref(found))
    sp.check_for_spice_error(None)
    if not found.value:
        return {"found": False}
    # SpiceyPy's to_python_string rstrips the scientific single blank and tabs.
    return {"found": True, "nthstr": output.value.decode("utf-8"), "size": size.value}
