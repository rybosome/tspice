"""Read or write an authored three-segment SPK through the locked independent toolkit."""

import json
import sys

import spiceypy as sp


def segment(kind, j):
    # Two time-ordered records with deliberately independent component expansions.
    if kind == 2:
        return [100+j, 2, 3, -200-j, -4, 5, 33+j, 6, -7]
    if kind == 3:
        return [100+j, 2, 3, -200-j, -4, 5, 33+j, 6, -7,
                7+j, -2, 1, 8+j, 4, -3, 9+j, -6, 2]
    return [1+j, 2, 10+j, -2-j, 3, 20+j, 3+j, -4, 30+j]


def write(path):
    h = sp.spkopn(path, "E04 INDEPENDENT", 0)
    try:
        for kind, writer in [(2, sp.spkw02), (3, sp.spkw03), (20, sp.spkw20)]:
            common = [h, 195000+kind, 0, "J2000", 0, 86400, f"E04 TYPE {kind}"]
            cdata = segment(kind, 0) + segment(kind, 1)
            if kind == 20:
                writer(*common, .5, 2, 1, cdata, 2, 4, 2451545, 0)
            else:
                writer(*common, 43200, 2, 2, cdata, 0)
    finally:
        sp.spkcls(h)


def read(path):
    sp.furnsh(path)
    records = []
    try:
        for kind in (2, 3, 20):
            body = 195000+kind
            handle, summary, ident = sp.spksfs(body, 11111, 41)
            metadata = sp.spkuds(summary)
            words = sp.dafgda(handle, metadata[6], metadata[7]).tolist()
            states = [sp.spkgeo(body, et, "J2000", 0)[0].tolist()
                      for et in (0, 11111, 21600, 43200, 64531, 64800, 86400)]
            records.append({"id": ident, "metadata": list(metadata),
                            "words": words, "states": states})
    finally:
        sp.kclear()
    return records


if __name__ == "__main__":
    if sys.argv[1] == "write":
        write(sys.argv[2])
    print(json.dumps(read(sys.argv[2]), allow_nan=False))
