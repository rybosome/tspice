"""Generate the MIT-authored CK type 2 record fixture with pinned SpiceyPy."""
from pathlib import Path
from math import cos, sin, sqrt
import spiceypy as sp

path = Path(__file__).parent / "kernels" / "audit-ck-records.bc"
path.unlink(missing_ok=True)
handle = sp.ckopn(str(path), "TSPICE CK RECORDS", 0)
starts = [1000., 1010., 1030.]
stops = [1005., 1020., 1040.]
rates = [.5, .75, 1.25]
quaternions = [[cos(a/2), *(i*sin(a/2)/sqrt(14) for i in (1,2,3))]
               for a in (.2, -.6, .8)]
velocities = [[.003,-.002,.001],[-.008,.005,.004],[.012,.006,-.002]]
try:
    sp.ckw02(handle, starts[0], stops[-1], -123002, "B1950", "TYPE 2 RECORDS",
             len(starts), starts, stops, quaternions, velocities, rates)
finally:
    sp.ckcls(handle)
handle = sp.dafopr(str(path))
try:
    sp.dafbfs(handle)
    assert sp.daffna()
    descriptor = sp.dafgs(5)
    assert sp.cknr02(handle, descriptor) == 3
    for i in range(3):
        record = sp.ckgr02(handle, descriptor, i+1)
        expected = [starts[i], stops[i], rates[i], *quaternions[i], *velocities[i]]
        assert max(abs(x-y) for x,y in zip(record,expected)) < 1e-15
finally:
    sp.dafcls(handle)

# A finite, deliberately extreme AV at a stored endpoint produces an IEEE
# overflow in the lower-left derivative block of the genuine CKFXFM matrix.
from math import pi
limit = path.with_name("audit-ck-record-limit.bc")
limit.unlink(missing_ok=True)
handle = sp.ckopn(str(limit), "TSPICE CK DERIVATIVE LIMIT", 0)
q = [cos(pi/8), 0., 0., sin(pi/8)]
av = [1.65e308, 1.65e308, 0.]
try:
    sp.ckw03(handle,1000.,1010.,-123009,"J2000",True,"FINITE AV LIMIT",
             2,[1000.,1010.],[q,q],[av,av],1,[1000.])
finally:
    sp.ckcls(handle)

# A DAF summary record fits 25 CK descriptors. Put the two directory-bearing
# targets into the second summary record and retain both record byte layouts.
directory = path.with_name("audit-ck-record-directory.bc")
directory.unlink(missing_ok=True)
handle = sp.ckopn(str(directory), "TSPICE CK DIRECTORY", 0)
try:
    identity = [1., 0., 0., 0.]
    for i in range(25):
        sp.ckw03(handle,1000.,1001.,-123100-i,"J2000",False,f"SMALL {i}",
                 1,[1000.],[identity],[[0.,0.,0.]],1,[1000.])
    starts = [1000.+2*i for i in range(102)]
    stops = [t+1 for t in starts]
    sp.ckw02(handle,starts[0],stops[-1],-123030,"J2000","DIRECTORY TYPE 2",
             len(starts),starts,stops,[identity]*len(starts),
             [[.001,-.002,.003]]*len(starts),[.25+i/512 for i in range(len(starts))])
    ticks = [1000.+i for i in range(103)]
    sp.ckw03(handle,ticks[0],ticks[-1],-123031,"B1950",False,"DIRECTORY TYPE 3",
             len(ticks),ticks,[identity]*len(ticks),[[0.,0.,0.]]*len(ticks),
             len(ticks),ticks)
finally:
    sp.ckcls(handle)
