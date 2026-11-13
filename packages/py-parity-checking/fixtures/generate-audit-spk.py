"""Generate MIT-authored deterministic type8 SPKs, independently through SpiceyPy."""
from pathlib import Path
import spiceypy as sp
from spiceypy.utils.support_types import SPICEINT_CELL,SPICEDOUBLE_CELL
root=Path(__file__).parent/'kernels'
def state(t,offset=0):
    return [10000+offset+1.25*t+.002*t*t,-20000-.75*t+.001*t*t,30000+.5*t-.0005*t*t,1.25+.004*t,-.75+.002*t,.5-.001*t]
def segment(h,body,center,first,last,ident,offset=0):
    times=[-2000.,-1000.,0.,1000.,2000.]
    sp.spkw08(h,body,center,'J2000',first,last,ident,2,len(times),[state(t,offset) for t in times],times[0],1000.)
def create(name,segments):
    path=root/name;path.unlink(missing_ok=True);h=sp.spkopn(str(path),'AUTHORED_SPK',0)
    try:
        for args in segments:segment(h,*args)
    finally:sp.spkcls(h)
    return path
main=create('audit-ephemeris.bsp',[
    (100001,0,-1000.,0.,'AUTHORED_TARGET_EARLY'),
    (100001,0,100.,1000.,'AUTHORED_TARGET_LATE'),
    (100002,0,-2000.,2000.,'AUTHORED_OBSERVER',-50000),
    (-100003,100001,-1000.,1000.,'AUTHORED_CHILD',1000),
    (-100010,0,-2000.,2000.,'AUTHORED_NEGATIVE_CENTER',-1000),
    (-100011,-100010,-1000.,1000.,'AUTHORED_NAN_DESCRIPTOR',-2000),
])
priority=create('audit-ephemeris-priority.bsp',[(100001,0,-500.,500.,'AUTHORED_PRIORITY',100000)])
empty=root/'audit-ephemeris-empty.bsp';empty.unlink(missing_ok=True);h=sp.spkopn(str(empty),'AUTHORED_EMPTY',0);sp.dafcls(h)
ids=list(sp.spkobj(str(main),SPICEINT_CELL(16)))
assert ids==[-100011,-100010,-100003,100001,100002],ids
cover=SPICEDOUBLE_CELL(8);sp.spkcov(str(main),100001,cover);assert list(cover)==[-1000.,0.,100.,1000.]
sp.furnsh(str(main))
try:
    actual,_=sp.spkgeo(100001,125.25,'J2000',0)
    assert max(abs(a-b) for a,b in zip(actual,state(125.25)))<1e-9
    handle,descriptor,ident=sp.spksfs(-100011,0.,41)
    fields=sp.spkuds(descriptor)
    assert fields[0]==-100011 and fields[1]==-100010 and fields[2:4]==(1,8)
    sp.furnsh(str(priority))
    actual,_=sp.spkgeo(100001,125.25,'J2000',0)
    assert max(abs(a-b) for a,b in zip(actual,state(125.25,100000)))<1e-9
finally:sp.kclear();sp.reset()
for path in [main,priority,empty]:print(path.name,path.stat().st_size)
