"""Independently write, close and inspect a variable-interval type 14 SPK."""
import json
import sys

import spiceypy as sp

ROWS = [[2, 2, 1, 2, 4, -1, 9, .25, -3, .5, 8, 1, 2, -2],
        [8, 4, 11, 3, -2, 2, 1, 5, 3, 1, -4, .5, 6, 2]]
TIMES = [0, 2, 3.5, 4, 8, 12]


def write(path):
    handle = sp.spkopn(path, "LOCKED STREAM", 0)
    try:
        sp.spk14b(handle, "INDEPENDENT", 196014, 0, "J2000", 0, 12, 1)
        # One bulk call, unlike the two additions made by each application backend.
        sp.spk14a(handle, 2, ROWS[0] + ROWS[1], [0, 4])
        sp.spk14e(handle)
        sp.spk14b(handle, "EMPTY", 196015, 0, "J2000", 0, 12, 1)
        sp.spk14e(handle)
    finally:
        sp.spkcls(handle)


def read(path):
    sp.furnsh(path)
    try:
        result = []
        for body in (196014, 196015):
            h, desc, ident = sp.spksfs(body, 0, 41)
            meta = sp.spkuds(desc)
            result.append(dict(ident=ident, meta=list(meta), words=sp.dafgda(h, meta[6], meta[7]).tolist(),
                               states=[sp.spkgeo(body, t, "J2000", 0)[0].tolist() for t in TIMES]
                               if body == 196014 else []))
        return result
    finally:
        sp.kclear()


if __name__ == "__main__":
    if sys.argv[1] == "write":
        write(sys.argv[2])
    print(json.dumps(read(sys.argv[2]), allow_nan=False))
