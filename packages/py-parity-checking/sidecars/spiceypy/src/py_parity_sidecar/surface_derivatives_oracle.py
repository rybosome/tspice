"""Reference outputs from the independent installed CSPICE library."""
import ctypes as ct
import spiceypy as sp
from . import geometry_quantities_oracle as g

_v3 = ct.c_double * 3
_v6 = ct.c_double * 6
_dnearp = g._bind("dnearp_c", [g._dp, g._d, g._d, g._d, g._dp, g._dp, g._ip])
_probe_ray = g._bind("surfpt_", [g._dp]*6 + [g._ip])
_parse_correction = g._bind("zzvalcor_", [g._str,g._ip,g._i])
_locus = g._bind("ljucrs_", [g._ip,g._str,ct.c_void_p,g._i,g._i])


def dnearp(state,a,b,c):
    # The locked high-level wrapper applies to_double_matrix to a six-vector.
    # The independent public ABI takes six contiguous doubles.
    near,alt,found = _v6(),(ct.c_double * 2)(),ct.c_int()
    _dnearp(_v6(*state),a,b,c,near,alt,ct.byref(found))
    sp.check_for_spice_error(None)
    result = dict(found=bool(found.value),position=list(near[:3]),altitude=alt[0])
    if found.value:
        result.update(velocity=list(near[3:]),altitudeRate=alt[1])
    return result


def surfpv(vertex,direction,a,b,c):
    # Check the originating intercept error before the C wrapper reads a logical.
    point,hit = _v3(),ct.c_int()
    with g._trace(b"surfpv_c",b"SURFPV"):
        _probe_ray(_v6(*vertex),_v6(*direction),ct.byref(g._d(a)),ct.byref(g._d(b)),ct.byref(g._d(c)),point,ct.byref(hit))
    sp.check_for_spice_error(None)
    with sp.no_found_check():
        state,found=sp.surfpv(vertex,direction,a,b,c)
    return dict(found=True,state=state.tolist()) if found else dict(found=False)


def tangpt(method,target,et,fixref,abcorr,corloc,observer,dref,dvec):
    strings = [g._text(v) for v in (method,target,fixref,abcorr,corloc,observer,dref)]
    if all(strings) and sp.eqstr(method,"ELLIPSOID") and any(dvec):
        locus = ct.create_string_buffer(15)
        _locus(ct.byref(g._i(0)),strings[4],locus,len(strings[4]),15)
        if locus.raw.rstrip(b" ") in (b"TANGENTPOINT", b"SURFACEPOINT"):
            with g._trace(b"tangpt_c",b"TANGPT"):
                _parse_correction(strings[3],(g._i*15)(),len(strings[3]))
            sp.check_for_spice_error(None)
            g._body_table_guard()
            with g._trace(b"tangpt_c",b"TANGPT"):
                for role,name in (("target",strings[1]),("observer",strings[5])):
                    with g._trace(b"ZZBODS2C"):
                        code=g._code(name)
                    if code is None:
                        if not sp.failed():
                            sp.setmsg("The #, '#', is not a recognized name for an ephemeris object. The cause of this problem may be that you need an updated version of the SPICE Toolkit, or that you failed to load a kernel containing a name-ID mapping for this body.")
                            sp.errch("#",role)
                            sp.errch("#",name.decode())
                            g._signal(b"SPICE(IDCODENOTFOUND)")
                        break
            sp.check_for_spice_error(None)
    tanpt,alt,distance,srfpt,trgepc,srfvec=sp.tangpt(method,target,et,fixref,abcorr,corloc,observer,dref,dvec)
    return dict(tanpt=tanpt.tolist(),alt=alt,range=distance,srfpt=srfpt.tolist(),trgepc=trgepc,srfvec=srfvec.tolist())
