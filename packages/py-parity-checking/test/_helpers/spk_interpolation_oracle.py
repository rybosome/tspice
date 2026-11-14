"""Independent bidirectional SPK fixture for types 9, 12, 13 and 18."""
import json
import sys
import spiceypy as sp

SEGMENTS = [(9,1), (12,1), (13,1), (18,0), (18,1)]


def grid(kind):
    return [(i-50)*.25 + (0 if kind==12 else (i%3)/64) for i in range(102)]


def packet(kind,sub,t):
    pos = [3+t*t, -9+2*t, 2-.25*t*t]
    rate = [2*t,2,-.5*t]
    velocity = [100+3*t+.125*t*t,-30+t,17-.5*t*t]
    accel = [3+.25*t,1,-t]
    if kind == 18 and sub == 0:
        return pos+rate+velocity+accel
    return pos+(rate if kind in (12,13) else velocity)


def write(path):
    handle=sp.spkopn(path,"INTERP ORACLE",0)
    try:
        for idx,(kind,sub) in enumerate(SEGMENTS):
            epochs=grid(kind)
            rows=[packet(kind,sub,t) for t in epochs]
            args=(196000+idx,0,"J2000",epochs[0],epochs[-1],f"INTERP {kind}/{sub}",3)
            if kind==18:
                sp.spkw18(handle,sub,*args,rows,epochs)
            elif kind==12:
                sp.spkw12(handle,*args,len(rows),rows,epochs[0],.25)
            elif kind==13:
                sp.spkw13(handle,*args,len(rows),rows,epochs)
            else:
                sp.spkw09(handle,*args,len(rows),rows,epochs)
    finally:
        sp.spkcls(handle)


def read(path):
    sp.furnsh(path)
    result=[]
    try:
        for idx,(kind,sub) in enumerate(SEGMENTS):
            epochs=grid(kind)
            body=196000+idx
            h,desc,identifier=sp.spksfs(body,1,41)
            meta=sp.spkuds(desc)
            queries=[epochs[0],epochs[0]+.046875,-1.6875,epochs[50],epochs[98],epochs[99],epochs[-1]-.046875,epochs[-1]]
            result.append({"metadata":list(meta),"id":identifier,
                           "words":sp.dafgda(h,meta[6],meta[7]).tolist(),
                           "states":[sp.spkgeo(body,t,"J2000",0)[0].tolist() for t in queries]})
    finally:
        sp.kclear()
    return result


if __name__=="__main__":
    if sys.argv[1]=="write":
        write(sys.argv[2])
    print(json.dumps(read(sys.argv[2]),allow_nan=False))
