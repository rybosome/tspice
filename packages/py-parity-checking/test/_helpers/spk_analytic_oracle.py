"""Create and inspect independent N0067 analytic SPKs, including physical DAF words."""
import ctypes
import json
import math
from pathlib import Path
import sys

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice_path

GM = 398600.4418
RADIUS = 7000.0
SPEED = math.sqrt(GM / RADIUS)
KINDS = (5, 10, 15, 17)
TIMES = (-300, -120.5, 0, 1, 300)
CONSTS = [.001082616, -2.53881e-6, -1.65597e-6, .0743669161, 120, 78, 6378.135, 1]
ELEMENTS = [0, 0, .00001, .5, .2, .03, .4, .7, .06, 0]


def write(path):
    handle = sp.spkopn(path, "INDEPENDENT ORBITS", 0)
    try:
        for kind in KINDS:
            args = (handle, 196000 + kind, 0, "J2000", -300, 300, f"TYPE {kind}")
            if kind == 5:
                sp.spkw05(*args, GM, 1, [[RADIUS, 0, 0, 0, SPEED, 0]], [0])
            elif kind == 10:
                sp.spkw10(*args, CONSTS, 1, ELEMENTS, [0])
            elif kind == 15:
                sp.spkw15(*args, 0, [0, 0, 3], [2, 0, 0], 7000, .1, 3, [0, 0, 2], GM, .001, 6378)
            else:
                sp.spkw17(*args, 0, [RADIUS, 0, 0, 0, 0, 0, 0, SPEED/RADIUS, 0], -math.pi/2, math.pi/2)
        # Zero packets retain real record metadata. SPKE10 requires elements.
        sp.spkw10(handle, 196099, 0, "J2000", -10, 10, "EMPTY", CONSTS, 0, [0.]*10, [0.])
    finally:
        sp.spkcls(handle)


def read(path):
    result = []
    sp.furnsh(str(Path(__file__).resolve().parents[2] / "fixtures/kernels/naif0012.tls"))
    sp.furnsh(path)
    try:
        for code in (*KINDS, 99):
            body = 196000 + code
            h, desc, name = sp.spksfs(body, 0, 41)
            meta = sp.spkuds(desc)
            result.append(dict(id=name, metadata=list(meta), words=sp.dafgda(h, meta[6], meta[7]).tolist(),
                               states=[] if code == 99 else [sp.spkgeo(body,t,"J2000",0)[0].tolist() for t in TIMES]))
    finally:
        sp.kclear()
    return result


def observe_open_segment(path):
    """The second reference fails after the first was accepted by SGWFPK."""
    handle = sp.spkopn(path, "GENERIC STATE", 0)
    observations = []
    try:
        for body, epochs in ((196001, [0, 0]), (196002, [0])):
            try:
                sp.spkw10(handle, body, 0, "J2000", -1, 1, "ORDER", CONSTS,
                          len(epochs), ELEMENTS * len(epochs), epochs)
            except sp.utils.exceptions.SpiceyError as error:
                observations.append(error.short)
        # Finish the real one-packet segment left open by the first canonical
        # call, after the high-level wrappers have captured/reset each error.
        close_segment = ctypes.CDLL(str(libspice_path)).sgwes_
        close_segment.argtypes = [ctypes.POINTER(ctypes.c_int)]
        close_segment.restype = ctypes.c_int
        close_segment(ctypes.byref(ctypes.c_int(handle)))
        sp.check_for_spice_error(None)
    finally:
        sp.spkcls(handle)
    return [*observations, list(sp.spkobj(path))]


if __name__ == "__main__":
    if sys.argv[1] == "order":
        print(json.dumps(observe_open_segment(sys.argv[2])))
        sys.exit(0)
    if sys.argv[1] == "write":
        write(sys.argv[2])
    print(json.dumps(read(sys.argv[2]), allow_nan=False))
