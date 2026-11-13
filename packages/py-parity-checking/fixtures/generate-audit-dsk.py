"""Generate authored MIT plate models using locked SpiceyPy/CSPICE N0067.

No external observations: invented vertices, triangles, IDs, bounds and epochs.
Run in this package: uv run --locked --project sidecars/spiceypy python
fixtures/generate-audit-dsk.py.
"""
from pathlib import Path
import numpy as np
import spiceypy as sp

root = Path(__file__).resolve().parent / "kernels"
vertices = np.array([[1,2,3],[4,2,3],[1,6,3],[1,2,8]], dtype=np.float64)
plates = np.array([[1,3,2],[1,2,4],[2,3,4],[3,1,4]], dtype=np.int32)
for name, segments in [("audit-empty-dsk.bds", []), ("audit-multi-dsk.bds", [(399,71),(399,72),(499,73),(399,71)])]:
    output = root / name
    output.unlink(missing_ok=True)
    h = sp.dskopn(str(output), "AUTHORED_STEP7_DSK", 0)
    try:
        for i, (body, surface) in enumerate(segments):
            sd, si = sp.dskmi2(vertices,plates,.5,2,100000,5000,5000,True,120000)
            sp.dskw02(h,body,surface,2,"J2000",3,np.zeros(10),1,4,2,6,3,8,i*100,i*100+75,vertices,plates,sd,si)
    finally:
        sp.dascls(h)
    h = sp.dasopr(str(output))
    observed = []
    try:
        with sp.no_found_check():
            descr, found = sp.dlabfs(h)
            while found:
                d = sp.dskgd(h,descr)
                observed.append((d.center,d.surfce))
                descr, found = sp.dlafns(h,descr)
    finally:
        sp.dascls(h)
    assert observed == segments, (observed, segments)
    print(output.name, output.stat().st_size, observed)
