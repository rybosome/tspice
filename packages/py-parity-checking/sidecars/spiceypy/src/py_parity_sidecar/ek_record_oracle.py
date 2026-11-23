"""Independent N0067 row-oriented EK calls, with owned full-width schema rows."""
import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceEKSegSum

_lib = ct.CDLL(libspice._name)
_schema = _lib.ekbseg_c
_schema.argtypes = [ct.c_int, ct.c_char_p, ct.c_int, ct.c_int, ct.c_void_p,
                    ct.c_int, ct.c_void_p, ct.POINTER(ct.c_int)]
_schema.restype = None


def column_names(summary):
    """Read N0067 cnames[100][33] from the returned struct's 3300-byte field."""
    if not 0 <= summary.ncols <= 100 or ct.sizeof(summary._cnames) != 3300:
        raise ValueError("Unexpected EK summary column field")
    # SpiceyPy 6.0.3 reverses the two ctypes dimensions (33 rows of 100).
    # Total size and offsets are correct. Read each public C row at offset 33*i.
    start = ct.addressof(summary) + SpiceEKSegSum._cnames.offset
    return [ct.string_at(start + 33*i, 33).split(b"\0", 1)[0].decode("utf-8")
            for i in range(summary.ncols)]


def record_schema(handle, table, names, decls):
    count = len(names)
    if not 1 <= count <= 100 or len(decls) != count:
        raise ValueError("EK schema requires 1..100 names and matching declarations")
    if any("\0" in s for s in (table, *names, *decls)):
        raise ValueError("Unexpected embedded NUL in EK schema")
    groups = [[s.encode("utf-8") for s in group] for group in (names, decls)]
    widths = [max(2, 1+max(map(len, group))) for group in groups]
    if any(count*w > 256*1024*1024 for w in widths) or len(table.encode("utf-8")) >= 256*1024*1024:
        raise ValueError("EK schema transfer exceeds the supported range")
    if all(s.isascii() and s for s in (*names, *decls)):
        return sp.ekbseg(handle, table, names, decls)
    # 6.0.3 computes character-count strides and cannot represent all-empty
    # groups with the same independently chosen nonzero physical widths.
    tables = [ct.create_string_buffer(b"".join(x.ljust(w,b"\0") for x in group),w*count)
              for w, group in zip(widths, groups)]
    segno = ct.c_int(0)
    _schema(handle, table.encode("utf-8"), count, widths[0], tables[0],
            widths[1], tables[1], ct.byref(segno))
    sp.check_for_spice_error(None)
    return segno.value


def edit_record(operation, handle, segment, row=None):
    if not -(2**31) <= segment < 2**31-1 or (
            row is not None and not -(2**31) <= row < 2**31-1):
        raise ValueError("EK ordinal exceeds the C-to-Fortran index conversion")
    # Confirm eligibility with the real descriptor (classes 7–9 are fixed
    # count). Never issue an incompatible row edit through the library.
    if 0 <= segment < sp.eknseg(handle):
        summary=sp.ekssum(handle,segment)
        if any(c.cclass not in range(1,7) for c in summary.cdescrs[:summary.ncols]):
            raise ValueError("EK row edits require a variable-count segment")
        if summary.nrows == 2**31-1 and operation != sp.ekdelr:
            raise ValueError("Cannot grow this EK record count")
    return operation(handle,segment) if row is None else operation(handle,segment,row)
