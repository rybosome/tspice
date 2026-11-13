"""MIT-authored shapes and ephemerides; no mission or external scientific data."""
from pathlib import Path
import itertools
import numpy as np
import spiceypy as sp
root=Path(__file__).parent/'kernels'
fk=root/'audit-geometry.tf'
text="KPL/FK\n\n\\begindata\n"
for body,code,name,radii in [(100101,1800201,'AUDIT_GEOMETRY_FIXED',(3,2,1)),(100103,1800203,'AUDIT_OCCULT_SMALL',(1,1,1)),(100105,1800205,'AUDIT_OCCULT_LARGE',(8,8,8))]:
    text+=f"FRAME_{name} = {code}\nFRAME_{code}_NAME = '{name}'\nFRAME_{code}_CLASS = 4\nFRAME_{code}_CLASS_ID = {code}\nFRAME_{code}_CENTER = {body}\nTKFRAME_{code}_RELATIVE = 'J2000'\nTKFRAME_{code}_SPEC = 'MATRIX'\nTKFRAME_{code}_MATRIX = (1 0 0 0 1 0 0 0 1)\nBODY{body}_RADII = ({' '.join(map(str,radii))})\n"
text+="FRAME_AUDIT_GEOMETRY_ROT = 1800202\nFRAME_1800202_NAME = 'AUDIT_GEOMETRY_ROT'\nFRAME_1800202_CLASS = 4\nFRAME_1800202_CLASS_ID = 1800202\nFRAME_1800202_CENTER = 100101\nTKFRAME_1800202_RELATIVE = 'J2000'\nTKFRAME_1800202_SPEC = 'ANGLES'\nTKFRAME_1800202_UNITS = 'DEGREES'\nTKFRAME_1800202_AXES = (3 2 1)\nTKFRAME_1800202_ANGLES = (30 0 0)\n\\begintext\n"
fk.write_text(text)
sp.furnsh(str(fk))
path=root/'audit-geometry.bsp';path.unlink(missing_ok=True)
h=sp.spkopn(str(path),'AUTHORED_GEOMETRY',0)
tracks=[(100101,[0,0,0],[0,0,0]),(100102,[10,4,3],[.01,-.002,.003]),(10,[100,50,20],[.001,.002,-.001]),(100103,[-20,0,0],[0,.1,0]),(100104,[20,0,0],[0,0,0]),(100105,[-20,0,0],[0,.1,0]),(100106,[-100,-50,-20],[-.001,-.002,.001])]
try:
    for body,pos,vel in tracks:
        times=[-10000.,10000.]
        states=[[pos[i]+t*vel[i] for i in range(3)]+vel for t in times]
        sp.spkw08(h,body,0,'J2000',-10000,10000,f'AUTHORED_GEOMETRY_{body}',1,2,states,-10000.,20000.)
finally:sp.spkcls(h)
vertices=np.array([[3,0,0],[-3,0,0],[0,2,0],[0,-2,0],[0,0,1],[0,0,-1]],dtype=np.float64)
plates=[]
for x,y,z in itertools.product([1,2],[3,4],[5,6]):
    face=[x,y,z];a,b,c=[vertices[i-1] for i in face]
    if np.dot(np.cross(b-a,c-a),a)<0:face=[x,z,y]
    plates.append(face)
plates=np.array(plates,dtype=np.int32)
dsk=root/'audit-geometry.bds';dsk.unlink(missing_ok=True);h=sp.dskopn(str(dsk),'AUTHORED_OCTAHEDRON',0)
try:
    sd,si=sp.dskmi2(vertices,plates,.5,2,100000,5000,5000,True,120000)
    sp.dskw02(h,100101,101,2,'AUDIT_GEOMETRY_FIXED',3,np.zeros(10),-3,3,-2,2,-1,1,-10000,10000,vertices,plates,sd,si)
finally:sp.dascls(h)
sp.furnsh(str(path));sp.furnsh(str(dsk))
try:
    p,t,v=sp.subpnt('Intercept: Ellipsoid','100101',0,'AUDIT_GEOMETRY_FIXED','NONE','100102')
    k=1/np.sqrt((10/3)**2+(4/2)**2+3**2)
    assert max(abs(p-np.array([10,4,3])*k))<1e-12
    p,t,v=sp.subpnt('Intercept: DSK/UNPRIORITIZED','100101',0,'AUDIT_GEOMETRY_FIXED','NONE','100102')
    k=1/(10/3+4/2+3)
    assert max(abs(p-np.array([10,4,3])*k))<1e-12
    assert sp.occult('100101','ELLIPSOID','AUDIT_GEOMETRY_FIXED','100103','ELLIPSOID','AUDIT_OCCULT_SMALL','NONE','100104',0)==3
    assert sp.occult('100101','ELLIPSOID','AUDIT_GEOMETRY_FIXED','100105','ELLIPSOID','AUDIT_OCCULT_LARGE','NONE','100104',0)==2
finally:sp.kclear();sp.reset()
for p in [fk,path,dsk]:print(p.name,p.stat().st_size)
