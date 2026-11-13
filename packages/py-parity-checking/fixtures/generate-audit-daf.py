"""Author tiny deterministic DAF/SPK fixtures; no external observations.

Generated with locked SpiceyPy 6.0.3 / CSPICE N0067. Synthetic state samples
and IDs are project-authored MIT test data. Run with the parity sidecar's uv
project, passing an output directory; only that directory is modified.
"""
from pathlib import Path
import sys
import numpy as np
import spiceypy as sp

root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
for name, segments in [('audit-two-segment.bsp', 2), ('audit-empty-daf.bsp', 0)]:
    target = root / name
    target.unlink(missing_ok=True)
    h = sp.spkopn(str(target), 'TSPICE AUTHORED STEP7 DAF', 0)
    try:
        for i in range(segments):
            epoch = float(i * 10)
            states = np.array([[epoch + j, 2 * (epoch + j), -3 * (epoch + j), 1, 2, -3] for j in range(3)], dtype=np.float64)
            sp.spkw08(h, 9100001 + i, 0, 'J2000', epoch, epoch + 2, f'AUDIT SEGMENT {i + 1}', 1, 3, states, epoch, 1.0)
    finally:
        # dafcls validly closes an empty DAF. spkcls adds a nonempty-segment
        # precondition, which is intentionally not desired for this fixture.
        sp.dafcls(h)
    sp.furnsh(str(target))
    try:
        reader = sp.dafopr(str(target))
        try:
            sp.dafbfs(reader)
            flags = [bool(sp.daffna()) for _ in range(segments + 2)]
            assert flags == [True] * segments + [False, False], flags
        finally:
            sp.dafcls(reader)
    finally:
        sp.kclear()
    print(name, target.stat().st_size, flags)
