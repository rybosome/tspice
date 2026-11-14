"""Independent N0067 fixed-position/velocity queries and checked stellar intermediates."""
import ctypes as ct
from contextlib import ExitStack
import spiceypy as sp

from . import correction_oracle as co

I, D, C, PI, PD = co.I, co.D, co.C, co.PI, co.PD
ref = ct.byref
_setup = co._bind("zzcvssta_", [PD, PI, PD, C, I], I)
_eval = co._bind("zzcvxsta_", [PD, C, PI, PD, I], I)
_ssb = co._bind("spkssb_", [PI, PD, C, PD, I], I)
_target_lt = co._bind("zzspkflt_", [ct.c_void_p, PD, C, C, PD, PD, PD, PD, I, I], I)
_obs_query = co._bind("zzspkfzo_", [PI, PD, C, C, ct.c_void_p, PD, PD, I, I], I)
_target_query = co._bind("zzspkfzt_", [ct.c_void_p, PD, C, C, PI, PD, PD, I, I], I)
_radii = co._bind("zzgftreb_", [PI, PD], I)
_near = co._bind("nearpt_", [PD, PD, PD, PD, PD, PD], I)
_normal = co._bind("surfnm_", [PD, PD, PD, PD, PD], I)
_axes = co._bind("twovec_", [PD, PI, PD, PI, PD], I)


def _check(fn):
    sp.check_for_spice_error(fn)


def _stellar(observer_point, other, center, epoch, frame, flag):
    samples = []
    for et in (epoch, epoch - 1, epoch + 1):
        if observer_point:
            offset, origin, center_id = co.V6(), co.V6(), I(center)
            _eval(ref(D(et)), frame, ref(center_id), offset, len(frame))
            if not co._failed():
                _ssb(ref(center_id), ref(D(et)), frame, origin, len(frame))
            if co._failed():
                return
            samples.append([a+b for a,b in zip(offset, origin)])
        else:
            samples.append(list(co.barycentric(other, et, frame)))
            if co._failed():
                return
    state = co.V6(*samples[0])
    acceleration = co.V3(*sp.qderiv(samples[1][3:], samples[2][3:], 1.0))
    transmit = flag.startswith(b"X")
    if observer_point:
        with co.trace(b"SPKAPS"):
            co.stellar_state(other, epoch, frame, flag, state, acceleration, transmit)
    else:
        with co.trace(b"ZZSPKFAP"):
            target = co.V6()
            _target_lt(_eval, ref(D(epoch)), frame, flag, state, target, ref(D()), ref(D()), len(frame), len(flag))
            if not co._failed():
                co._stellar(ref(I(transmit)), acceleration, co.V3(*state[3:]), target, co.V3(), co.V3())


def _relative(observer_point, fixed, other_name, et, outref, locus, flag, point, point_epoch, center_name, point_frame):
    observer_locus = sp.eqstr(locus,"OBSERVER")
    center_locus = sp.eqstr(locus,"CENTER")
    if "+S" not in flag and not (observer_locus and flag in ("CN","LT","XCN","XLT")):
        return
    if flag not in ("LT","CN","XLT","XCN","LT+S","CN+S","XLT+S","XCN+S"):
        return
    with sp.no_found_check():
        center, found_center = sp.bods2c(center_name)
        other, found_other = sp.bods2c(other_name)
    frame = sp.namfrm(outref)
    if not (found_center and found_other and frame and (observer_locus or center_locus or sp.eqstr(locus,"TARGET"))):
        return
    with ExitStack() as stack:
        if fixed:
            stack.enter_context(co.trace(b"SPKCPO" if observer_point else b"SPKCPT"))
        stack.enter_context(co.trace(b"SPKCVO" if observer_point else b"SPKCVT"))
        state = co.V6(*point, *([0.,0.,0.] if fixed else []))
        _setup(state, ref(I(center)), ref(D(point_epoch)), point_frame.encode(), len(point_frame.encode()))
        flag = flag.encode()
        fr = b"J2000"
        with ExitStack() as inner:
            if observer_locus or center_locus:
                inner.enter_context(co.trace(b"ZZSPKFZO" if observer_point else b"ZZSPKFZT"))
            if center_locus and sp.frinfo(frame)[1] == 1:
                fr = outref.encode()
            if b"+S" in flag:
                inner.enter_context(co.trace(b"ZZSPKFAO" if observer_point else b"ZZSPKFAT"))
                _stellar(observer_point,other,center,et,fr,flag)
        if not co._failed() and observer_locus and frame==1:
            if observer_point:
                _obs_query(ref(I(other)),ref(D(et)),b"J2000",flag,_eval,co.V6(),ref(D()),5,len(flag))
            else:
                _target_query(_eval,ref(D(et)),b"J2000",flag,ref(I(other)),co.V6(),ref(D()),5,len(flag))


def _azimuth(method, target, et, flag, pos, center_name, frame_name):
    with sp.no_found_check():
        center, ok = sp.bods2c(center_name)
        code = sp.namfrm(frame_name)
        fcenter, _, _, found = sp.frinfo(code)
    if not (ok and found and center==fcenter and sp.eqstr(method,"ELLIPSOID")):
        return
    with co.trace(b"AZLCPO"):
        if pos[0] or pos[1]:
            radii, nearest, normal = co.V3(), co.V3(), co.V3()
            _radii(ref(I(center)), radii)
            radii_ptr = [ct.cast(ct.byref(radii,8*i),PD) for i in range(3)]
            if not co._failed(): _near(co.V3(*pos), *radii_ptr, nearest,ref(D()))
            if not co._failed(): _normal(*radii_ptr,nearest,normal)
            if not co._failed(): _axes(normal,ref(I(3)),co.V3(0,0,1),ref(I(1)),(D*9)())
        if not co._failed():
            _relative(True,True,target,et,frame_name,"OBSERVER",flag,pos,0,center_name,frame_name)


def evaluate(name, values):
    p = dict(values)
    p["abcorr"] = co.option(p["abcorr"])
    if all(v for v in p.values() if isinstance(v,str)):
        with co.trace((name+"_c").encode()):
            if name=="azlcpo":
                _azimuth(p["method"],p["target"],p["et"],p["abcorr"],p["obspos"],p["obsctr"],p["obsref"])
            else:
                obs = name in ("spkcpo","spkcvo")
                fixed = name in ("spkcpo","spkcpt")
                k = "obs" if obs else "trg"
                _relative(obs,fixed,p["target" if obs else "obsrvr"],p["et"],p["outref"],p["refloc"],p["abcorr"],
                          p[k+("pos" if fixed else "sta")],p.get(k+"epc",0),p[k+"ctr"],p[k+"ref"])
        _check(evaluate)
    return getattr(sp,name)(**p)
