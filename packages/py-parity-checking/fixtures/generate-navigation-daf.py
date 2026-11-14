"""Generate a scratch-only DAF with known packed integer bits using locked SpiceyPy.

The segment identifiers, states, epochs and body IDs are original synthetic
MIT test data. No external kernel or mission data is needed.
"""
import ctypes as ct
import json
import math
from pathlib import Path
import sys

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice


def generate(path: Path) -> list[int]:
    if path.exists():
        raise FileExistsError(path)
    name = "C01  PACKED  SUMMARY  BYTES"
    # No physical meaning. A negative center and positive body produce a
    # non-canonical NaN payload when their packed integer words are mistaken
    # for an IEEE double on supported little-endian runtimes.
    body, center = 9100701, -1
    writer = sp.spkopn(str(path), "TSPICE C01 PACKED SUMMARY", 0)
    try:
        states = [[1., 2., 3., 4., 5., 6.], [2., 3., 4., 4., 5., 6.]]
        sp.spkw08(writer, body, center, "J2000", -2.5, 3.5, name, 1, 2, states, -2.5, 6.)
    finally:
        sp.dafcls(writer)
    # SPK writers accept printable segment IDs. The more general DAF
    # interface permits a terminal tab: rename using N0067 DAFRN, rather
    # than patching the binary. SpiceZfc.h declares char* and ftnlen (int).
    new_name = (name + "\t").encode("ascii")
    lib = ct.CDLL(libspice._name)
    lib.dafrn_.argtypes = [ct.c_char_p, ct.c_int]
    lib.dafrn_.restype = ct.c_int
    lib.dafgn_c.argtypes = [ct.c_int, ct.POINTER(ct.c_char)]
    lib.dafgn_c.restype = None
    writer = sp.dafopw(str(path))
    try:
        sp.dafbfs(writer)
        assert sp.daffna()
        lib.dafrn_(new_name, len(new_name))
        sp.check_for_spice_error(None)
    finally:
        sp.dafcls(writer)
    handle = sp.dafopr(str(path))
    try:
        nd, ni = sp.dafhsf(handle)
        sp.dafbfs(handle)
        assert sp.daffna()
        out = ct.create_string_buffer(1001)
        lib.dafgn_c(len(out), out)
        sp.check_for_spice_error(None)
        assert out.value == new_name and (nd, ni) == (2, 6)
        # The Python convenience decoder strips terminal whitespace.
        assert sp.dafgn() == name
        packed = sp.dafgs(nd + (ni + 1) // 2)
        numeric, integers = sp.dafus(packed, nd, ni)
        assert numeric.tolist() == [-2.5, 3.5]
        assert integers[:4].tolist() == [body, center, 1, 8]
        assert len(packed.tobytes()) == 40
        if sys.byteorder == "little":
            assert math.isnan(packed[2])
        return list(packed.tobytes())
    finally:
        sp.dafcls(handle)


if __name__ == "__main__":
    print(json.dumps(generate(Path(sys.argv[1]))))
