"""Actual DAS routines in the independently built, locked SpiceyPy shared library."""

import ctypes as c

import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError

_library = c.CDLL(sp.libspice._name)
_int = c.c_int
_ip = c.POINTER(_int)
_limit = 256 * 1024 * 1024
_links: dict[int, int] = {}
_positions: dict[int, int] = {}


def _bind(name, args, result=None):
    fn = getattr(_library, name)
    fn.argtypes = args
    fn.restype = result
    return fn


_add = _bind("dasac_c", [_int, _int, _int, c.c_void_p])
_page = _bind("dasec_", [_ip, _ip, _ip, c.c_void_p, _ip, _int], _int)
_cpage = _bind("dasec_c", [_int, _int, _int, _ip, c.c_void_p, _ip])
_convert = _bind("F2C_ConvertTrStrArr", [_int, _int, c.c_void_p])
_unit = _bind("zzddhhlu_", [_ip, c.c_char_p, _ip, _ip, _int], _int)
_record = _bind("dasioc_", [c.c_char_p, _ip, _ip, c.c_void_p, _int, _int], _int)
_checkin = _bind("chkin_c", [c.c_char_p])
_checkout = _bind("chkout_c", [c.c_char_p])
_signal = _bind("sigerr_c", [c.c_char_p])


def prepare():
    # N0067 DASEC's no-cached-record sentinel is -1. The DDH assigns -1 to
    # the first write open in a fresh process. Consume that number without
    # extracting anything, so all scientific comparisons use ordinary DASEC.
    h = sp.dasops()
    sp.dascls(h)


def opened(h):
    _links[h] = _links.get(h, 0) + 1


def _rows(h, header):
    _, _, reserved, _, _, used = header
    if reserved < 0 or used < 0 or reserved + 2 + used // 1024 >= 2**31:
        raise ValueError("Unsupported DAS comment header")
    unit = _int()
    _unit(c.byref(_int(h)), b"DAS", c.byref(_int(0)), c.byref(unit), 3)
    sp.check_for_spice_error(None)
    pos = _positions.get(h, 0)
    length = 0
    while pos < used:
        record = c.create_string_buffer(1024)
        number = _int(reserved + 2 + pos // 1024)
        _record(b"READ", c.byref(unit), c.byref(number), record, 4, 1024)
        sp.check_for_spice_error(None)
        for byte in record.raw[pos % 1024:]:
            pos += 1
            if byte == 0:
                yield length, pos
                length = 0
            else:
                length += 1
            if pos == used:
                break
    if length:
        raise ValueError("Incomplete DAS comment line")


def append(h, lines):
    if len(lines) > _limit // 2:
        raise ValueError("Too many DAS comment lines")
    width_cap = _limit // max(1, len(lines))
    if any(len(line) >= width_cap or "\0" in line for line in lines):
        raise ValueError("Unsupported DAS comment input")
    rows = [(line or " ").encode("utf-8", "strict") for line in lines]
    width = max(2, 1 + max(map(len, rows), default=0))
    size = width * len(rows)
    if size > _limit:
        raise ValueError("DAS input exceeds supported row table")
    if h < 0 and h in _positions and rows and all(32 <= b <= 126 for row in rows for b in row):
        raise ValueError("Finish the active DAS comment extraction before mutation")
    if rows and all(row.isascii() for row in rows):
        sp.dasac(h, [row.decode("ascii") for row in rows])
        return
    buf = c.create_string_buffer(max(1, size))
    for i, row in enumerate(rows):
        c.memmove(c.addressof(buf) + i * width, row, len(row))
    _add(h, len(rows), width, buf)
    sp.check_for_spice_error(None)


def delete(h):
    if h < 0 and h in _positions:
        raise ValueError("Finish the active DAS comment extraction before mutation")
    sp.dasdc(h)


def extract(h, rows, width):
    if any(x < -(2**31) or x >= 2**31 for x in (rows, width)):
        raise ValueError("DAS page counts must fit signed SpiceInt")
    size = rows * width if rows > 0 and width >= 2 else 1
    if size > _limit:
        raise ValueError("DAS output exceeds supported page extent")
    buf = c.create_string_buffer(size)
    n, done = _int(), _int()
    if width < 2:
        # The public adapter checks width before touching its private logical.
        _cpage(h, rows, width, c.byref(n), buf, c.byref(done))
        sp.check_for_spice_error(None)
        raise AssertionError("Expected canonical width error")
    pos = _positions.get(h, 0)
    next_pos = pos
    header = None
    if rows > 0:
        try:
            header = sp.dasrfr(h)
        except SpiceyError:
            # The inner DASEC returns immediately on a bad DAS file record.
            # Preserve its trace instead of substituting the preflight trace.
            pass
    if header is not None:
        for i, (length, next_pos) in enumerate(_rows(h, header), 1):
            if length >= width:
                # A safe initial first-record failure uses the actual inner
                # routine. For late/cross-file failures preserve its exact
                # error without disturbing the original static record cache.
                if _positions or (next_pos - 1) // 1024 != pos // 1024:
                    _checkin(b"dasec_c")
                    _checkin(b"DASEC")
                    try:
                        sp.setmsg("The output buffer line length (#) was not long enough to contain a comment line with length #.")
                        sp.errint("#", width - 1)
                        sp.errint("#", i)
                        _signal(b"SPICE(COMMENTTOOLONG)")
                    finally:
                        _checkout(b"DASEC")
                        _checkout(b"dasec_c")
                    sp.check_for_spice_error(None)
                break
            if i == rows:
                break
    if h == -1 and header is not None and header[-1] > 0:
        raise ValueError("Independent DASEC must use a non-sentinel handle")
    _checkin(b"dasec_c")
    try:
        _page(c.byref(_int(h)), c.byref(_int(rows)), c.byref(n), buf, c.byref(done), width - 1)
    finally:
        _checkout(b"dasec_c")
    sp.check_for_spice_error(None)
    if not 0 <= n.value <= rows:
        raise ValueError("Invalid DASEC output count")
    if n.value:
        _convert(n.value, width, buf)
    if done.value:
        _positions.pop(h, None)
    else:
        _positions[h] = next_pos
    lines = [c.string_at(c.addressof(buf) + i * width).decode("utf-8", "strict") for i in range(n.value)]
    return {"n": n.value, "lines": lines, "done": bool(done.value)}


def close(h, low=False):
    if _links.get(h) == 1:
        while h in _positions:
            length, _ = next(_rows(h, sp.dasrfr(h)))
            extract(h, 1, max(2, length + 1))
    (sp.dasllc if low else sp.dascls)(h)
    if h in _links:
        _links[h] -= 1
        if not _links[h]:
            del _links[h]
