"""Marshal independent workflow fields to the locked analytic SPK writers."""
import math

import spiceypy as sp

from .models import (
    StepEphemerisSpkw05,
    StepEphemerisSpkw10,
    StepEphemerisSpkw15,
    StepEphemerisSpkw17,
)


def write_analytic(
    handle: int,
    step: StepEphemerisSpkw05 | StepEphemerisSpkw10 | StepEphemerisSpkw15 | StepEphemerisSpkw17,
) -> None:
    if not all(-(2**31) <= value < 2**31 for value in (step.body, step.center)):
        raise ValueError("SPK body or center exceeds signed 32-bit")
    if "\0" in step.frame or "\0" in step.segid:
        raise ValueError("Embedded NUL in SPK strings")

    common = (handle, step.body, step.center, step.frame, step.first, step.last, step.segid)
    parts = [[step.first, step.last]]
    if isinstance(step, StepEphemerisSpkw05):
        n = len(step.epochs)
        if len(step.states) != 6 * n or 7 * n + 1 > 33554432:
            raise ValueError("Incomplete or oversized type 5 orbit data")
        parts.extend(([step.gm], step.states, step.epochs))
    elif isinstance(step, StepEphemerisSpkw10):
        n = len(step.epochs)
        if len(step.consts) != 8 or len(step.elems) != 10 * n or 8 + 11 * n > 33554432:
            raise ValueError("Incomplete or oversized type 10 element data")
        if any(a >= b for a, b in zip(step.epochs, step.epochs[1:])):
            raise ValueError("Type 10 reference epochs must rise before opening its generic segment")
        parts.extend((step.consts, step.elems, step.epochs))
    elif isinstance(step, StepEphemerisSpkw15):
        if not math.isfinite(step.j2flg) or not -(2**31) <= math.trunc(step.j2flg) < 2**31:
            raise ValueError("Type 15 flag exceeds evaluation range")
        parts.extend((
            [step.epoch, step.p, step.ecc, step.j2flg, step.gm, step.j2, step.radius],
            list(step.tp), list(step.pa), list(step.pv),
        ))
    else:
        if len(step.eqel) != 9:
            raise ValueError("Expected nine equinoctial elements")
        parts.extend(([step.epoch, step.rapol, step.decpol], step.eqel))

    if not all(math.isfinite(value) for part in parts for value in part):
        raise ValueError("Nonfinite analytic SPK field")
    if isinstance(step, StepEphemerisSpkw05):
        rows = [step.states[i:i+6] for i in range(0, len(step.states), 6)]
        # At explicit n=0 the locked matrix conversion still needs an initialized row.
        sp.spkw05(*common, step.gm, len(step.epochs), rows or [[0.0]*6], step.epochs or [0.0])
    elif isinstance(step, StepEphemerisSpkw10):
        sp.spkw10(*common, step.consts, len(step.epochs), step.elems or [0.0]*10, step.epochs or [0.0])
    elif isinstance(step, StepEphemerisSpkw15):
        sp.spkw15(
            *common, step.epoch, step.tp, step.pa, step.p, step.ecc, step.j2flg,
            step.pv, step.gm, step.j2, step.radius,
        )
    else:
        sp.spkw17(*common, step.epoch, step.eqel, step.rapol, step.decpol)
