from __future__ import annotations

import spiceypy as sp

from .. import civil_time_oracle
from ..models import (
    StepOutput,
    StepTimeDeltet,
    StepTimeEt2Utc,
    StepTimeScdecd,
    StepTimeScencd,
    StepTimeSce2c,
    StepTimeSce2s,
    StepTimeScs2e,
    StepTimeSct2e,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    StepTimeTimout,
    StepTimeTkvrsn,
    StepTimeEtcal,
    StepTimeUtc2et,
    StepTimeTparch,
    StepTimeTsetyr,
    StepTimeEt2lst,
    StepTimeTparse,
    StepTimeTpictr,
    StepTimeUnitim,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext

SPICE_OUTPUT_LEN = 4096


def _expect_non_empty(value: str, *, label: str) -> str:
    if value == "":
        raise ValueError(f"{label} must be a non-empty string")
    return value


def run_time_step(step: WorkflowStep, _context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepTimeStr2Et):
        et = float(sp.str2et(step.time))
        return StepOutput(op=step.op, value=et)

    if isinstance(step, StepTimeEt2Utc):
        utc = str(sp.et2utc(step.et, step.format, step.prec))
        return StepOutput(op=step.op, value=utc)

    if isinstance(step, StepTimeTkvrsn):
        if step.item != "TOOLKIT":
            raise ValueError("time.tkvrsn.item must be TOOLKIT")
        value = str(sp.tkvrsn(step.item))
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepTimeTimout):
        picture = _expect_non_empty(step.picture, label="time.timout.picture")
        value = str(sp.timout(step.et, picture, SPICE_OUTPUT_LEN))
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepTimeDeltet):
        value = float(sp.deltet(step.epoch, step.eptype))
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepTimeUnitim):
        value = float(sp.unitim(step.epoch, step.insys, step.outsys))
        julian = step.outsys.strip().upper() in {"JED", "JDTDB", "JDTDT"}
        seconds = (value - 2451545) * 86400 if julian else value
        return StepOutput(op=step.op, value={"epoch": value, "secondsPastJ2000": seconds})

    if isinstance(step, StepTimeEtcal):
        return StepOutput(op=step.op, value=civil_time_oracle.calendar(step.et, step.callen))

    if isinstance(step, StepTimeUtc2et):
        return StepOutput(op=step.op, value=civil_time_oracle.utc_et(step.utcstr))

    if isinstance(step, StepTimeTparch):
        label = "time.tparch.restore"
        if not any(key == label for key, _ in _context.finalizers):
            _, diagnostic = sp.tparse("1993 April 31 12:00:00")
            mode = "YES" if diagnostic else "NO"
            _context.register_finalizer(label, lambda: sp.tparch(mode))
        sp.tparch(step.type)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepTimeTsetyr):
        label = "time.tsetyr.restore"
        if not any(key == label for key, _ in _context.finalizers):
            years = []
            for suffix in range(100):
                epoch, message = sp.tparse(f"JAN 01 '{suffix:02}")
                if message:
                    raise ValueError(message)
                years.append(int(sp.etcal(epoch).split()[0]))
            lower = min(years)
            _context.register_finalizer(label, lambda: sp.tsetyr(lower))
        if not -(2**31) <= step.year <= (2**31 - 1) // 367 - 99:
            raise ValueError("tsetyr window exceeds the calendar integer range")
        sp.tsetyr(step.year)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepTimeEt2lst):
        return StepOutput(op=step.op, value=civil_time_oracle.solar_time(
            step.et, step.body, step.lon, step.type, step.timlen, step.ampmlen))

    if isinstance(step, StepTimeTparse):
        timstr = _expect_non_empty(step.timstr, label="time.tparse.timstr")
        et, errmsg = sp.tparse(timstr, SPICE_OUTPUT_LEN)
        if str(errmsg).strip() != "":
            raise ValueError(str(errmsg).strip())
        return StepOutput(op=step.op, value=float(et))

    if isinstance(step, StepTimeTpictr):
        sample = _expect_non_empty(step.sample, label="time.tpictr.sample")
        _expect_non_empty(step.pictur, label="time.tpictr.pictur")

        # SpiceyPy does not expose the output-template argument used by tspice's raw
        # API, but CSPICE picture derivation is sample-driven. We keep the same
        # input validation behavior and derive the output picture from sample.
        picture, ok, errmsg = sp.tpictr(sample, SPICE_OUTPUT_LEN, SPICE_OUTPUT_LEN)
        if int(ok) != 1:
            message = str(errmsg).strip()
            raise ValueError(message if message != "" else "tpictr failed")

        return StepOutput(op=step.op, value=str(picture))

    if isinstance(step, StepTimeTimdefGet):
        value = sp.timdef("GET", step.item, SPICE_OUTPUT_LEN)
        return StepOutput(op=step.op, value=str(value))

    if isinstance(step, StepTimeTimdefSet):
        label = "time.defaults.restore"
        if not any(name == label for name, _ in _context.finalizers):
            calendar = str(sp.timdef("GET", "CALENDAR", SPICE_OUTPUT_LEN))
            system = str(sp.timdef("GET", "SYSTEM", SPICE_OUTPUT_LEN))
            zone = str(sp.timdef("GET", "ZONE", SPICE_OUTPUT_LEN))

            def restore_defaults() -> None:
                sp.timdef("SET", "CALENDAR", SPICE_OUTPUT_LEN, calendar)
                if system:
                    sp.timdef("SET", "SYSTEM", SPICE_OUTPUT_LEN, system)
                elif zone:
                    sp.timdef("SET", "ZONE", SPICE_OUTPUT_LEN, zone)

            _context.register_finalizer(label, restore_defaults)
        sp.timdef("SET", step.item, SPICE_OUTPUT_LEN, step.value)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepTimeScs2e):
        et = float(sp.scs2e(step.sc, step.sclkch))
        return StepOutput(op=step.op, value=et)

    if isinstance(step, StepTimeSce2s):
        sclkch = str(sp.sce2s(step.sc, step.et, SPICE_OUTPUT_LEN))
        return StepOutput(op=step.op, value=sclkch)

    if isinstance(step, StepTimeScencd):
        sclkdp = float(sp.scencd(step.sc, step.sclkch))
        return StepOutput(op=step.op, value=sclkdp)

    if isinstance(step, StepTimeScdecd):
        sclkch = str(sp.scdecd(step.sc, step.sclkdp, SPICE_OUTPUT_LEN))
        return StepOutput(op=step.op, value=sclkch)

    if isinstance(step, StepTimeSct2e):
        et = float(sp.sct2e(step.sc, step.sclkdp))
        return StepOutput(op=step.op, value=et)

    if isinstance(step, StepTimeSce2c):
        sclkdp = float(sp.sce2c(step.sc, step.et))
        return StepOutput(op=step.op, value=sclkdp)

    return None
