"""Independent locked N0067 calls, with checked prerequisites for legacy error paths."""
import ctypes as c

import spiceypy as sp

from .geometry_quantities_oracle import _body_table_guard


def _body_ids(*names):
    _body_table_guard()
    with sp.no_found_check():
        for name in names:
            code, found = sp.bods2c(name)
            if not found:
                return
            if code == -(2**31):
                raise ValueError("Body outside the N0067 signed hash domain")


def _id(name):
    with sp.no_found_check():
        return sp.bods2c(name)[0]


def _default_frame(target, observer):
    _body_ids(target, observer)
    with sp.no_found_check():
        code, known = sp.bods2c(target)
        obs, found = sp.bods2c(observer)
        if not known or not found or code == obs:
            return None
        _, frame, found = sp.cidfrm(code)
    if not found:
        return None
    return frame


def illum(target, et, abcorr, observer, spoint):
    if target and abcorr and observer:
        frame = _default_frame(target, observer)
        if frame:
            _, lt = sp.spkezr(target, et, frame, abcorr, observer)
            tepoch = et if sp.eqstr(abcorr, "NONE") else et - lt
            sp.spkezr("SUN", tepoch, frame, abcorr, target)
            radii = sp.bodvrd(target, "RADII", 3)[1]
            if len(radii) == 3:
                sp.surfnm(*radii, spoint)
    phase, solar, emissn = sp.illum(target, et, abcorr, observer, spoint)
    return {"phase": phase, "solar": solar, "emissn": emissn}


def _sub_prerequisites(method, target, et, abcorr, observer, solar):
    if not all((method, target, abcorr, observer)):
        return
    frame = _default_frame(target, observer)
    if not frame:
        return
    # N0067 checks target radii before the default frame and the SPK lookup.
    sp.bodvrd(target, "RADII", 3)
    if solar:
        t = et
        if not sp.eqstr(abcorr, "NONE"):
            t, _ = sp.ltime(et, _id(observer), "<-", _id(target))
        pos, _ = sp.spkpos("SUN", t, frame, abcorr, target)
    else:
        state, _ = sp.spkezr(target, et, frame, abcorr, observer)
        pos = -state[:3]
    if sp.eqstr(method, "INTERCEPT"):
        radii = sp.bodvrd(target, "RADII", 3)[1]
        if len(radii) == 3:
            with sp.no_found_check():
                sp.surfpt([0, 0, 0], pos, *radii)


def subpt(method, target, et, abcorr, observer):
    _sub_prerequisites(method, target, et, abcorr, observer, False)
    spoint, alt = sp.subpt(method, target, et, abcorr, observer)
    return {"spoint": spoint.tolist(), "alt": alt}


def subsol(method, target, et, abcorr, observer):
    _sub_prerequisites(method, target, et, abcorr, observer, True)
    return sp.subsol(method, target, et, abcorr, observer).tolist()


def srfxpt(method, target, et, abcorr, observer, dref, dvec):
    if all((method, target, abcorr, observer, dref)):
        frame = _default_frame(target, observer)
        if frame:
            correction = abcorr.lstrip(" ").upper()[:15].replace("+S", "", 1)
            sp.spkpos(target, et, frame, correction, observer)
            # Well-defined registered rays use inertial or fixed, target-centered
            # direction frames and SPKs covering the entire short light-time arc.
            # On this domain the observer state below is available at input ET.
            if sp.namfrm(dref):
                sp.spkssb(_id(observer), et, "J2000")
    with sp.no_found_check():
        point, dist, epoch, pos, found = sp.srfxpt(method, target, et, abcorr, observer, dref, dvec)
    if not found:
        return {"found": False}
    return {"found": True, "spoint": point.tolist(), "dist": dist, "trgepc": epoch, "obspos": pos.tolist()}


def edterm(trmtyp, source, target, et, fixref, abcorr, observer, npts):
    if not -(2**31) <= npts <= 11184809:
        raise ValueError("EDTERM output exceeds the bounded signed count")
    if all((trmtyp, source, target, fixref, abcorr, observer)):
        _body_ids(target, source, observer)
    if npts < 1:
        # SpiceyPy allocates npts*3 words before dispatch. Use a non-null,
        # one-row sentinel for the actual count diagnostic.
        from spiceypy.utils import support_types as st
        epoch, pos, rows = c.c_double(), st.empty_double_vector(3), st.empty_double_matrix(3,1)
        sp.libspice.edterm_c(trmtyp.encode(),source.encode(),target.encode(),c.c_double(et),fixref.encode(),
                             abcorr.encode(),observer.encode(),c.c_int(npts),c.byref(epoch),pos,rows)
        sp.check_for_spice_error(sp.edterm)
        raise AssertionError("Expected real EDTERM INVALIDSIZE")
    epoch, pos, points = sp.edterm(trmtyp, source, target, et, fixref, abcorr, observer, npts)
    return {"trgepc": epoch, "obspos": pos.tolist(), "trmpts": points.tolist()}
