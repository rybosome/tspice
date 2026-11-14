"""Write seven synthetic CK segments with independently locked SpiceyPy 6.0.3."""
from pathlib import Path
from tempfile import TemporaryDirectory
import spiceypy as sp


def write(path: Path) -> None:
    h = sp.ckopn(str(path), "TSPICE CK RECORDS", 17)
    ticks = [1000., 1010.]
    q = [[1., 0., 0., 0.], [.98,.1,.1,.1]]
    av = [[.01,.02,.03],[.04,.05,.06]]
    dq = [[0.,.004,.003,-.002],[-.001,.005,.002,-.003]]
    dav = [[.002,.003,-.004],[.001,-.003,.006]]
    sp.ckw01(h,1000,1010,-123000,"J2000",True,"DISCRETE",2,ticks,q,av)
    sp.ckw02(h,1000,1010,-123001,"J2000","CONSTANT",1,[1000],[1010],q[:1],[[.001,.002,.003]],[.5])
    sp.ckw03(h,1000,1010,-123002,"J2000",True,"INTERPOLATED",2,ticks,q,av,1,[1000])
    for subtype in range(4):
        packets=[q[i]+(dq[i] if subtype in (0,2) else [])+(av[i] if subtype in (2,3) else [])+(dav[i] if subtype==2 else []) for i in range(2)]
        sp.ckw05(h,subtype,3 if subtype in (0,2) else 1,1000,1010,-123003-subtype,"J2000",True,"PACKETS"+str(subtype),ticks,packets,.5,1,[1000])
    sp.ckcls(h)


if __name__ == "__main__":
    with TemporaryDirectory() as directory:
        path = Path(directory)/"records.bc"
        write(path)
        (Path(__file__).parent/"kernels"/"audit-ck-writers.bc").write_bytes(path.read_bytes())
