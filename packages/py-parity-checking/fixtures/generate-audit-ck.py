"""Generate MIT-authored deterministic CK pointing and verify actual pointing/coverage."""
from pathlib import Path
import math
import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL, SPICEINT_CELL
root=Path(__file__).parent/'kernels'

def write_segment(handle,inst,times,starts,axis,rate,base,av=True):
 norm=math.sqrt(sum(x*x for x in axis));unit=[x/norm for x in axis]
 angles=[base+rate*(t-times[0]) for t in times]
 quats=[[math.cos(a/2),*[x*math.sin(a/2) for x in unit]] for a in angles]
 velocities=[[-x*rate for x in unit] for _ in times]
 sp.ckw03(handle,times[0],times[-1],inst,'J2000',av,'AUTHORED_TYPE3',len(times),times,quats,velocities,len(starts),starts)

def create(name,segments):
 output=root/name;output.unlink(missing_ok=True);h=sp.ckopn(str(output),'AUTHORED_CK',0)
 try:
  for args in segments:write_segment(h,*args)
 finally:sp.ckcls(h)
 print(name,output.stat().st_size)
create('audit-pointing.bc',[
 (-123000,[1000.,1010.,1030.,1040.],[1000.,1030.],[1,2,3],.002,.3,True),
 (-123000,[1060.,1070.],[1060.],[1,2,3],.002,1.2,True),
 (-123001,[1000.,1040.],[1000.],[0,1,0],.001,-.4,False),
])
create('audit-pointing-priority.bc',[
 (-123000,[1000.,1040.],[1000.],[1,0,0],.004,1.1,True),
])
empty=root/'audit-pointing-empty.bc';empty.unlink(missing_ok=True);h=sp.ckopn(str(empty),'AUTHORED_EMPTY_CK',0);sp.dafcls(h)
print(empty.name,empty.stat().st_size)
sp.furnsh(str(root/'audit-ck-clock.tsc'))
h=sp.cklpf(str(root/'audit-pointing.bc'))
try:
 assert sp.sct2e(-123,1000) == 0
 matrix,av,clock=sp.ckgpav(-123000,1005.,0.,'J2000')
 assert clock==1005. and abs(matrix[0,0]-.9557383148938767)<1e-14
 assert max(abs(av[i]+.002*(i+1)/math.sqrt(14)) for i in range(3))<1e-14
 hstep=.001
 plus=sp.ckgp(-123000,1005.+hstep,0.,'J2000')[0]
 minus=sp.ckgp(-123000,1005.-hstep,0.,'J2000')[0]
 state=sp.rav2xf(matrix,av)
 assert max(abs(state[i+3,j]-(plus[i,j]-minus[i,j])/(2*hstep)) for i in range(3) for j in range(3))<1e-10
 with sp.no_found_check():
  assert not sp.ckgpav(-123000,1012.,0.,'J2000')[-1]
  assert sp.ckgpav(-123000,1012.,3.,'J2000')[-2]==1010.
 cover=SPICEDOUBLE_CELL(32)
 sp.ckcov(str(root/'audit-pointing.bc'),-123000,True,'INTERVAL',0.,'TDB',cover)
 assert list(cover)==[0.,10.,30.,40.,60.,70.]
 assert list(sp.ckobj(str(root/'audit-pointing.bc'),SPICEINT_CELL(10)))==[-123001,-123000]
 for time,tol in [(1000.,0.),(1005.,0.),(1012.,0.),(1012.,3.),(1050.,0.)]:
  with sp.no_found_check():print('pointing',time,tol,sp.ckgpav(-123000,time,tol,'J2000'))
 for needav,level,tol,timsys in [(False,'SEGMENT',0.,'SCLK'),(False,'INTERVAL',0.,'SCLK'),(True,'INTERVAL',10.,'SCLK'),(True,'INTERVAL',0.,'TDB')]:
  cover=SPICEDOUBLE_CELL(32);sp.ckcov(str(root/'audit-pointing.bc'),-123000,needav,level,tol,timsys,cover);print('coverage',needav,level,tol,timsys,list(cover))
 print('objects',list(sp.ckobj(str(root/'audit-pointing.bc'),SPICEINT_CELL(10))))
finally:sp.ckupf(h);sp.kclear();sp.reset()
