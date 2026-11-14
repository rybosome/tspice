"""Build the MIT-authored, disconnected type 2 DSK used by E20 surface cuts."""
import itertools
from pathlib import Path

import numpy as np
import spiceypy as sp

root = Path(__file__).parent / "kernels"
vertices = []
plates = []
# Two separated closed octahedra in the target frame. The northern cutting
# half-plane can contain three tangent transitions; other cuts see one.
for center, radii in [([0, 0, 0], [1.5, 1, 0.8]), ([0, 0, 4], [0.75, 0.64, 0.62])]:
    octahedron = np.array([[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]]) * radii
    offset = len(vertices)
    vertices.extend(octahedron + center)
    for x, y, z in itertools.product((0,1), (2,3), (4,5)):
        face = [x,y,z]
        a,b,c = octahedron[face]
        if np.dot(np.cross(b-a,c-a),a) < 0:
            face = [x,z,y]
        plates.append([offset + i + 1 for i in face])

vertices = np.array(vertices,dtype=np.float64)
plates = np.array(plates,dtype=np.int32)
path = root / "audit-surface-cuts.bds"
path.unlink(missing_ok=True)
sp.furnsh(str(root / "audit-geometry.tf"))
try:
    h = sp.dskopn(str(path), "SYNTHETIC_DISJOINT", 0)
    try:
        # 103 includes both components, 104 isolates the off-center component.
        for surface_id, grid, faces in [(103, vertices, plates), (104, vertices[6:], plates[8:] - 6)]:
            sd, si = sp.dskmi2(grid, faces, 0.5, 2, 100000, 5000, 5000, True, 120000)
            lo, hi = grid.min(axis=0), grid.max(axis=0)
            sp.dskw02(h, 100101, surface_id, 2, "AUDIT_GEOMETRY_FIXED", 3, np.zeros(10),
                      lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], -10000, 10000, grid, faces, sd, si)
    finally:
        sp.dascls(h)
finally:
    sp.kclear()
