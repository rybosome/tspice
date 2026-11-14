"""Generate MIT-authored observer states with distinct three-axis motion."""
from pathlib import Path
import spiceypy as sp
path=Path(__file__).parent/'kernels'/'audit-ephemeris-observer.bsp'
def state(t):
    return [-40000-1.5*t+.0003*t*t,-15000+.25*t-.0002*t*t,28000-.1*t+.00015*t*t,-1.5+.0006*t,.25-.0004*t,-.1+.0003*t]
times=[-2000.,-1000.,0.,1000.,2000.]
path.unlink(missing_ok=True)
h=sp.spkopn(str(path),'AUTHORED_OBSERVER',0)
try:sp.spkw08(h,100002,0,'J2000',-2000,2000,'AUTHORED_THREE_AXIS_OBSERVER',2,len(times),[state(t) for t in times],times[0],1000.)
finally:sp.spkcls(h)
sp.furnsh(str(path))
try:
    actual=sp.spkssb(100002,125.25,'J2000')
    assert max(abs(a-b) for a,b in zip(actual,state(125.25)))<1e-9
finally:sp.kclear();sp.reset()
print(path.name,path.stat().st_size)
