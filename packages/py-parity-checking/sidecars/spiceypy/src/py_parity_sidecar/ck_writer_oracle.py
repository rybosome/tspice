"""Shape checked case data into the real locked SpiceyPy CK writer interfaces."""
import spiceypy as sp
from .models.frames import StepFramesCkw01, StepFramesCkw02, StepFramesCkw03, StepFramesCkw05


def rows(data: list[float], count: int, width: int) -> list[list[float]]:
    if len(data) != count*width:
        raise ValueError("CK field length mismatch")
    return [data[i*width:(i+1)*width] for i in range(count)] or [[0.0]*width]


def write_ck_record_segment(h: int, s: StepFramesCkw01|StepFramesCkw02|StepFramesCkw03|StepFramesCkw05) -> None:
    if isinstance(s,StepFramesCkw05):
        n = len(s.ticks)
        if not (0 <= s.subtype <= 3 and s.degree < 2147483647):
            raise ValueError("Unsupported CK oracle subtype/degree")
        if s.intervalStarts and n and s.intervalStarts[0] != s.ticks[0]:
            raise ValueError("CK type 5 requires its first interval to begin at the first packet")
        width = [8,4,14,7][s.subtype]
        if not n:
            # The wrapper infers its packet count from the matrix. Preserve a
            # zero count and non-null caller-owned storage using its own library.
            import ctypes as ct
            from spiceypy.utils.libspicehelper import libspice
            dummy=(ct.c_double*14)()
            libspice.ckw05_c(h,s.subtype,s.degree,s.beg,s.end,s.inst,s.ref.encode(),s.av,s.segid.encode(),0,dummy,dummy,s.rate,len(s.intervalStarts),dummy)
            sp.check_for_spice_error(sp.ckw05)
            return
        sp.ckw05(h,s.subtype,s.degree,s.beg,s.end,s.inst,s.ref,s.av,s.segid,s.ticks,rows(s.packets,n,width),s.rate,len(s.intervalStarts),s.intervalStarts or [0.0])
        return
    times=s.starts if isinstance(s,StepFramesCkw02) else s.ticks
    n=len(times)
    q=rows(s.quats,n,4)
    if isinstance(s,StepFramesCkw02):
        if len(s.stops)!=n or len(s.rates)!=n: raise ValueError("CK interval array length mismatch")
        sp.ckw02(h,s.beg,s.end,s.inst,s.ref,s.segid,n,times or [0.0],s.stops or [0.0],q,rows(s.avvs,n,3),s.rates or [0.0]);return
    av=rows(s.avvs,n,3) if s.av or s.avvs else [[0.0]*3 for _ in range(max(n,1))]
    if isinstance(s,StepFramesCkw01):
        sp.ckw01(h,s.beg,s.end,s.inst,s.ref,s.av,s.segid,n,times or [0.0],q,av)
    else:
        sp.ckw03(h,s.beg,s.end,s.inst,s.ref,s.av,s.segid,n,times or [0.0],q,av,len(s.intervalStarts),s.intervalStarts or [0.0])
