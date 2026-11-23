"""DAF mutations use the real library distributed with locked SpiceyPy 6.0.3."""

import ctypes as c
from pathlib import Path

import numpy as np
import spiceypy as sp

_lib = c.CDLL(sp.libspice._name)
_i = c.c_int
_ip = c.POINTER(_i)
_limit = 256 * 1024 * 1024
_links: dict[int, int] = {}
_files: dict[int, tuple[Path, bool]] = {}
_positions: dict[int, int] = {}


def _bind(name, args, result=None):
    f = getattr(_lib, name)
    f.argtypes = args
    f.restype = result
    return f


_add = _bind("dafac_c", [_i, _i, _i, c.c_void_p])
_page = _bind("dafec_", [_ip, _ip, _ip, c.c_void_p, _ip, _i], _i)
_cpage = _bind("dafec_c", [_i, _i, _i, _ip, c.c_void_p, _ip])
_convert = _bind("F2C_ConvertTrStrArr", [_i, _i, c.c_void_p])
_in = _bind("chkin_c", [c.c_char_p])
_out = _bind("chkout_c", [c.c_char_p])
_signal = _bind("sigerr_c", [c.c_char_p])


def opened(handle, path, writable):
    _files[handle] = (Path(path), writable)
    _links[handle] = _links.get(handle, 0) + 1


def close(handle):
    if _links.get(handle) == 1 and handle in _positions:
        while handle in _positions:
            # Size one row from the independent file's actual bytes.
            length = len(next(_raw_rows(handle, _positions[handle]))[0])
            extract(handle, 1, max(2, length + 1))
    sp.dafcls(handle)
    if handle in _links:
        _links[handle] -= 1
        if not _links[handle]:
            del _links[handle]
            del _files[handle]


def _raw_rows(handle, offset):
    """Stream only the 1000 payload bytes per physical 1024-byte record."""
    name, _ = _files[handle]
    _, _, _, first, _, _ = sp.dafrfr(handle)
    if first < 2 or (first - 2) * 1000 >= 2**31:
        raise ValueError("Unsupported DAF comment record layout")
    line = bytearray()
    with Path(name).open("rb") as f:
        index, start = divmod(offset, 1000)
        for k in range(index, first - 2):
            f.seek((1 + k) * 1024)
            data = f.read(1000)
            if len(data) != 1000:
                raise ValueError("Incomplete DAF comment record")
            for ch in data[start:]:
                offset += 1
                if ch == 4:
                    return
                if ch == 0:
                    yield bytes(line), offset
                    line.clear()
                else:
                    if len(line) >= _limit - 1:
                        raise ValueError("DAF comment line exceeds supported storage")
                    line.append(ch)
            start = 0


def append(handle, lines):
    if len(lines) > _limit // 2:
        raise ValueError("Too many DAF comment lines")
    max_width = _limit // max(1, len(lines))
    if any(len(s) >= max_width for s in lines):
        raise ValueError("DAF comment table exceeds supported storage")
    data = [(s or " ").encode("utf-8", "strict") for s in lines]
    if any(b"\0" in row for row in data):
        raise ValueError("Embedded NUL in a comment")
    width = max(2, 1 + max(map(len, data), default=0))
    if len(data) * width > _limit:
        raise ValueError("DAF comment table exceeds supported storage")
    if handle in _positions and _files[handle][1] and data and all(
        all(32 <= ch <= 126 for ch in row) for row in data
    ):
        raise ValueError("Finish the active DAF comment extraction")
    if data and all(row.isascii() for row in data):
        # All bytes are representable by the high-level wrapper's Python
        # character-counted width. CSPICE itself rejects nonprinting bytes.
        sp.dafac(handle, [row.decode("ascii") for row in data])
    else:
        raw = c.create_string_buffer(max(1, len(data) * width))
        for index, row in enumerate(data):
            c.memmove(c.addressof(raw) + index * width, row, len(row))
        _add(handle, len(data), width, raw)
        sp.check_for_spice_error(None)


def delete(handle):
    if handle in _positions and _files[handle][1]:
        raise ValueError("Finish the active DAF comment extraction")
    sp.dafdc(handle)


def extract(handle, rows, width):
    if not all(-(2**31) <= x < 2**31 for x in (rows, width)):
        raise ValueError("DAF output capacities must fit SpiceInt")
    size = rows * width if rows > 0 and width >= 2 else 1
    if size > _limit:
        raise ValueError("DAF comment page exceeds supported storage")
    data = c.create_string_buffer(size)
    n, done = _i(0), _i(0)
    offset = _positions.get(handle, 0)
    next_offset = offset
    short = False
    if rows > 0 and width >= 2:
        for idx, (line, next_offset) in enumerate(_raw_rows(handle, offset), 1):
            if len(line) >= width:
                short = True
                break
            if idx == rows:
                break
    if width < 2:
        # CHKOSTR returns before the C wrapper reads its private logical.
        _cpage(handle, rows, width, c.byref(n), data, c.byref(done))
    elif rows <= 0 or short:
        # Invalid count and COMMENTTOOLONG are safe with initialized output.
        # Registered short-line cases stay within a single physical record.
        # Never invoke the original cross-record cache failure on a live cursor.
        if short and (_positions or (next_offset - 1) // 1000 != offset // 1000):
            # The translated diagnostic is documented by its safe first-record
            # counterpart. Its original error subsystem can issue the same
            # status without disturbing DAFEC's shared physical-record cache.
            _in(b"dafec_c")
            _in(b"DAFEC")
            try:
                sp.setmsg("The output buffer line length (#) was not long enough to contain comment line #.")
                sp.errint("#", width - 1)
                sp.errint("#", idx)
                _signal(b"SPICE(COMMENTTOOLONG)")
            finally:
                _out(b"DAFEC")
                _out(b"dafec_c")
            sp.check_for_spice_error(None)
        _in(b"dafec_c")
        try:
            _page(c.byref(_i(handle)), c.byref(_i(rows)), c.byref(n), data,
                  c.byref(done), width - 1)
        finally:
            _out(b"dafec_c")
    else:
        # The public wrapper's Python decoder strips more than ASCII spaces.
        # Use its original linked operation and converter to retain exact bytes.
        _in(b"dafec_c")
        try:
            _page(c.byref(_i(handle)), c.byref(_i(rows)), c.byref(n), data,
                  c.byref(done), width - 1)
        finally:
            _out(b"dafec_c")
        sp.check_for_spice_error(None)
        if not 0 <= n.value <= rows:
            raise ValueError("Invalid DAFEC result row count")
        _convert(n.value, width, data)
        if done.value:
            _positions.pop(handle, None)
        else:
            _positions[handle] = next_offset
        lines = [c.string_at(c.addressof(data) + i * width).decode("utf-8", "strict")
                 for i in range(n.value)]
        return {"n": n.value, "lines": lines, "done": bool(done.value)}
    sp.check_for_spice_error(None)
    raise AssertionError("Expected real DAFEC status")


def replace(handle, summary):
    sp.dafcs(handle)
    nd, ni = sp.dafhsf(handle)
    words = nd + (ni + 1) // 2
    if not (0 <= nd <= 124 and 2 <= ni <= 250 and words <= 125 and len(summary) == 8 * words):
        raise ValueError("Invalid packed DAF summary extent")
    aligned = np.frombuffer(bytes(summary), dtype=np.float64).copy()
    sp.dafrs(aligned)
