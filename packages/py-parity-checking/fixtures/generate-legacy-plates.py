"""Build the MIT-authored latitudinal type 2 test mesh using locked N0067."""

import math
from pathlib import Path
import spiceypy as sp
import numpy as np

root = Path(__file__).parent / "kernels"
path = root / "audit-legacy-plates.bds"
sp.furnsh(str(root / "audit-geometry.tf"))
try:
    # Use identical oriented triangles to the rectangular audit-geometry.bds.
    reference = sp.dasopr(str(root / "audit-geometry.bds"))
    try:
        desc = sp.dlabfs(reference)
        nv, np_ = sp.dskz02(reference, desc)
        vertices = sp.dskv02(reference, desc, 1, nv)
        plates = sp.dskp02(reference, desc, 1, np_)
    finally:
        sp.dascls(reference)
    params = np.zeros(10)
    low, high = sp.dskrb2(vertices, plates, 1, params)
    sd, si = sp.dskmi2(vertices, plates, 0.5, 2, 100000, 5000, 5000, True, 120000)
    path.unlink(missing_ok=True)
    handle = sp.dskopn(str(path), "AUTHORED_LATITUDINAL_OCTAHEDRON", 0)
    try:
        sp.dskw02(
            handle,
            100101,
            105,
            2,
            "AUDIT_GEOMETRY_FIXED",
            1,
            params,
            -math.pi,
            math.pi,
            -math.pi / 2,
            math.pi / 2,
            low,
            high,
            -10000,
            10000,
            vertices,
            plates,
            sd,
            si,
        )
    finally:
        sp.dskcls(handle, True)
finally:
    sp.kclear()
