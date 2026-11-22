"""Independent locked GF entry points, caller-supplied functions and observed samples."""

import ctypes as c
import math

import spiceypy as sp
from spiceypy.utils.callbacks import SpiceUDFUNC, SpiceUDFUNS, SpiceUDFUNB
from spiceypy.utils.libspicehelper import libspice
from .models.geometry_gf import StepGeometryGfGfudb, StepGeometryGfUddc

# The normal SpiceyPy wrapper deliberately initializes UDF's in/out word to zero.
# Keep an independent prototype for the cases with an explicit initial accumulator.
_reference = c.CDLL(libspice._name)
_udf = _reference.udf_c
_udf.argtypes = [c.c_double, c.POINTER(c.c_double)]
_udf.restype = None


def dummy_scalar(et, initial):
    if initial is None:
        return float(sp.udf(et))
    word = c.c_double(initial)
    _udf(et, c.byref(word))
    sp.check_for_spice_error(_udf)
    return word.value


def _measurement(name, samples):
    functions = {
        "constant": lambda t: 7.0,
        "identity": lambda t: t,
        "negativeAffine": lambda t: 4 - 2 * t,
        "square": lambda t: t * t,
        "negativeSquare": lambda t: -(t * t),
        "cubic": lambda t: t * t * t - 3 * t,
    }
    equation = functions[name]

    def measure(et):
        value = equation(et)
        samples.append([et, value])
        return value

    return measure


def derivative(step):
    if not step.dx or not all(
        math.isfinite(t) for t in (step.x - step.dx, step.x + step.dx)
    ):
        raise ValueError(
            "Reference derivative requires finite sample epochs and a nonzero step"
        )
    samples = []
    equation = _measurement(step.scalar, [])
    if not all(
        math.isfinite(equation(t)) for t in (step.x - step.dx, step.x + step.dx)
    ):
        raise ValueError("Reference derivative callback exceeds finite scalar domain")
    scalar = SpiceUDFUNC(_measurement(step.scalar, samples))
    if isinstance(step, StepGeometryGfUddc):
        return {
            "decreasing": bool(sp.uddc(scalar, step.x, step.dx)),
            "scalarSamples": samples,
        }
    return {
        "derivative": float(sp.uddf(scalar, step.x, step.dx)),
        "scalarSamples": samples,
    }


def _read(scalar, et):
    value = c.c_double()
    scalar(et, c.byref(value))
    return value.value


def search(step, confinement, result):
    if confinement is result:
        raise ValueError("GF input and result windows must be distinct")
    if step.step > 0:
        for i in range(sp.wncard(confinement)):
            a, b = sp.wnfetd(confinement, i)
            if a < b and (
                a + step.step == a
                or math.nextafter(b, a) + step.step == math.nextafter(b, a)
            ):
                raise ValueError("Search step cannot advance across reference interval")
    samples, conditions = [], []
    scalar = SpiceUDFUNS(_measurement(step.scalar, samples))
    if isinstance(step, StepGeometryGfGfudb):
        if step.predicate not in {"above", "below", "always", "never"}:
            raise ValueError("Unknown GF predicate")

        @SpiceUDFUNB
        def condition(f, t):
            if step.predicate == "above":
                value = _read(f, t) > step.threshold
            elif step.predicate == "below":
                value = _read(f, t) < step.threshold
            else:
                value = step.predicate == "always"
            conditions.append([t, value])
            return value

        sp.gfudb(scalar, condition, step.step, confinement, result)
    else:
        if step.nintvls > (268435456 // (8 * 15) - 6) // 2:
            raise ValueError("GF workspace exceeds supported byte bound")
        if not math.isfinite(step.conditionDx) or step.conditionDx <= 0:
            raise ValueError("Decreasing-condition sampling width must be positive")

        @SpiceUDFUNB
        def decreasing(f, t):
            left = _read(f, t - step.conditionDx)
            right = _read(f, t + step.conditionDx)
            value = right < left
            conditions.append([t, value])
            return value

        sp.gfuds(
            scalar,
            decreasing,
            step.relate,
            step.refval,
            step.adjust,
            step.step,
            step.nintvls,
            confinement,
            result,
        )
    return {"scalarSamples": samples, "conditionSamples": conditions}
