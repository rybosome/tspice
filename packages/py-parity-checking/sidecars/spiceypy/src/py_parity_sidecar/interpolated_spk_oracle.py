"""Call the independent locked SPK writers with complete initialized packets."""
import math

import numpy as np
import spiceypy as sp

from .models import StepEphemerisSpkw09, StepEphemerisSpkw12, StepEphemerisSpkw13, StepEphemerisSpkw18


def write_interpolated_spk(handle, step):
    """Preserve every state word and invoke the correct canonical writer."""
    fixed = isinstance(step, StepEphemerisSpkw12)
    is18 = isinstance(step, StepEphemerisSpkw18)
    subtype = step.subtype if is18 else 1
    for value in (step.body, step.center, subtype, step.degree):
        if not -(2**31) <= value < 2**31:
            raise ValueError("SPK integer exceeds signed 32-bit ABI")
    if "\0" in step.frame or "\0" in step.segid:
        raise ValueError("Embedded NUL in frame or segment ID")
    if not all(math.isfinite(x) for x in ([step.first,step.last,step.epoch0,step.step]
                                         if fixed else [step.first,step.last])):
        raise ValueError("Expected finite SPK time input")
    data = step.packets if is18 else step.states
    epochs = [] if fixed else step.epochs
    if len(data)>33554432 or len(epochs)>33554432:
        raise ValueError("SPK buffer exceeds 256 MiB")
    if is18 and subtype not in (0, 1):
        # N0067 checks the subtype before it inspects the degree or any packet.
        return sp.spkw18(handle,subtype,step.body,step.center,step.frame,step.first,
                         step.last,step.segid,step.degree,np.empty((0,6)),[0.0])
    if not isinstance(step, StepEphemerisSpkw09) and step.degree == 2**31-1:
        raise ValueError("N0067 window size exceeds signed arithmetic")
    width = 12 if is18 and subtype == 0 else 6
    n, rem = divmod(len(data),width)
    if rem or (not fixed and len(epochs) != n):
        raise ValueError("Incomplete SPK packet or epoch buffer")
    if not all(math.isfinite(x) for x in data) or not all(math.isfinite(x) for x in epochs):
        raise ValueError("Nonfinite SPK interpolation input")
    if is18 and n==0:
        # Prove the empty matrix actually has both dimensions, since the
        # wrapper infers count from the number of physical rows.
        return sp.spkw18(handle,subtype,step.body,step.center,step.frame,step.first,
                         step.last,step.segid,step.degree,np.empty((0,width)),[0.0])
    # Explicit-count writers do not inspect the buffer for n=0.
    rows = [data[k:k+width] for k in range(0,len(data),width)] or [[0.0]*width]
    common = (step.body,step.center,step.frame,step.first,step.last,step.segid,step.degree)
    if is18:
        sp.spkw18(handle,subtype,*common,rows,epochs)
    elif fixed:
        sp.spkw12(handle,*common,n,rows,step.epoch0,step.step)
    elif isinstance(step,StepEphemerisSpkw13):
        sp.spkw13(handle,*common,n,rows,epochs or [0.0])
    else:
        sp.spkw09(handle,*common,n,rows,epochs or [0.0])
