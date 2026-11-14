"""Generate an MIT-authored outer octahedral surface for DSK ray selection."""
from pathlib import Path
from itertools import product
import numpy as np
import spiceypy as sp
root = Path(__file__).parent / "kernels"
out = root / "audit-dsk-ray-outer.bds"
out.unlink(missing_ok=True)
sp.furnsh(str(root / "audit-geometry.tf"))
vertices = np.array([[6.,0,0],[-6.,0,0],[0,4.,0],[0,-4.,0],[0,0,2.],[0,0,-2.]])
plates = []
for ix, iy, iz in product([0,1], [2,3], [4,5]):
    a,b,c=vertices[[ix,iy,iz]]
    plates.append([ix+1,iy+1,iz+1] if np.cross(b-a,c-a).dot(a)>0 else [ix+1,iz+1,iy+1])
plates=np.array(plates,dtype=np.int32)
sd,si=sp.dskmi2(vertices,plates,.5,2,100000,5000,5000,True,120000)
h=sp.dskopn(str(out),"AUTHORED OUTER OCTAHEDRON",0)
try:
    sp.dskw02(h,100101,102,2,"AUDIT_GEOMETRY_FIXED",3,np.zeros(10),-6,6,-4,4,-2,2,-30,30,vertices,plates,sd,si)
finally:
    sp.dskcls(h,True)
sp.kclear()
