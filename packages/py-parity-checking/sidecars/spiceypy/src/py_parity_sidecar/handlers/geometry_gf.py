from __future__ import annotations

import ctypes
import os
import sys
from contextlib import contextmanager
from typing import Any, Iterator, MutableMapping

import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL

from ..models import (
    StepGeometryGfGfdist,
    StepGeometryGfGfrefn,
    StepGeometryGfGfrepf,
    StepGeometryGfGfrepi,
    StepGeometryGfGfoclt,
    StepGeometryGfGfrfov,
    StepGeometryGfGftfov,
    StepGeometryGfGfpa,
    StepGeometryGfGfposc,
    StepGeometryGfGfrr,
    StepGeometryGfGfsntc,
    StepGeometryGfGfsubc,
    StepGeometryGfGfilum,
    StepGeometryGfGfsep,
    StepGeometryGfGfsstp,
    StepGeometryGfGfstep,
    StepGeometryGfGfstol,
    StepOutput,
    WorkflowStep,
)

WindowStore = MutableMapping[str, Any]


def _require_window(windows: WindowStore, window_id: str) -> Any:
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def _get_or_create_window(windows: WindowStore, window_id: str, *, max_intervals: int) -> Any:
    existing = windows.get(window_id)
    if existing is not None:
        return existing
    if max_intervals < 0:
        raise ValueError("maxIntervals must be >= 0")

    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    return window


def _visibility_output(op: str, confinement: Any, result: Any) -> StepOutput:
    def intervals(window: Any) -> list[list[float]]:
        return [list(map(float, sp.wnfetd(window, i))) for i in range(sp.wncard(window))]

    return StepOutput(op=op, value={
        "intervals": intervals(result),
        "confinementIntervals": intervals(confinement),
    })


_libc = ctypes.CDLL(None)
_libc.fflush.argtypes = [ctypes.c_void_p]
_libc.fflush.restype = ctypes.c_int


def _flush_native_stdout() -> None:
    # Python's text stream flush does not drain libc's CSPICE/f2c buffers.
    if _libc.fflush(None) != 0:
        raise OSError("Could not flush native progress output")


@contextmanager
def _suppress_native_stdout() -> Iterator[None]:
    """Temporarily redirect FD1 to preserve sidecar JSON stdout protocol."""
    try:
        sys.stdout.flush()
    except BaseException:
        pass

    _flush_native_stdout()
    saved_stdout_fd = os.dup(1)
    try:
        with open(os.devnull, "w", encoding="utf-8") as devnull:
            os.dup2(devnull.fileno(), 1)
            try:
                yield
            finally:
                _flush_native_stdout()
    finally:
        os.dup2(saved_stdout_fd, 1)
        os.close(saved_stdout_fd)
        try:
            sys.stdout.flush()
        except BaseException:
            pass


def run_geometry_gf_step(step: WorkflowStep, windows: WindowStore) -> StepOutput | None:
    if isinstance(step, StepGeometryGfGfsstp):
        sp.gfsstp(step.step)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepGeometryGfGfstep):
        out = float(sp.gfstep(step.time))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepGeometryGfGfstol):
        sp.gfstol(step.value)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepGeometryGfGfrefn):
        out = float(sp.gfrefn(step.t1, step.t2, step.s1, step.s2))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepGeometryGfGfrepi):
        window = _require_window(windows, step.windowId)
        with _suppress_native_stdout():
            sp.gfrepi(window, step.begmss, step.endmss)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepGeometryGfGfrepf):
        with _suppress_native_stdout():
            sp.gfrepf()
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepGeometryGfGfoclt):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfoclt(step.occtyp, step.front, step.fshape, step.fframe, step.back, step.bshape, step.bframe, step.abcorr, step.obsrvr, step.step, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfrfov):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfrfov(step.inst, step.raydir, step.rframe, step.abcorr, step.obsrvr, step.step, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGftfov):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gftfov(step.inst, step.target, step.tshape, step.tframe, step.abcorr, step.obsrvr, step.step, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfpa):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfpa(step.target, step.illmn, step.abcorr, step.obsrvr, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfposc):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfposc(step.target, step.frame, step.abcorr, step.obsrvr, step.crdsys, step.coord, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfrr):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfrr(step.target, step.abcorr, step.obsrvr, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfsntc):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfsntc(step.target, step.fixref, step.method, step.abcorr, step.obsrvr, step.dref, step.dvec, step.crdsys, step.coord, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfsubc):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfsubc(step.target, step.fixref, step.method, step.abcorr, step.obsrvr, step.crdsys, step.coord, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfilum):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else 8)
        sp.gfilum(step.method, step.angtyp, step.target, step.illmn, step.fixref, step.abcorr, step.obsrvr, step.spoint, step.relate, step.refval, step.adjust, step.step, step.nintvls, cnfine, result)
        return _visibility_output(step.op, cnfine, result)

    if isinstance(step, StepGeometryGfGfsep):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else max(step.nintvls, 8))
        sp.gfsep(
            step.targ1,
            step.shape1,
            step.frame1,
            step.targ2,
            step.shape2,
            step.frame2,
            step.abcorr,
            step.obsrvr,
            step.relate,
            step.refval,
            step.adjust,
            step.step,
            step.nintvls,
            cnfine,
            result,
        )
        return StepOutput(op=step.op, value={"intervals":[list(map(float,sp.wnfetd(result,i))) for i in range(sp.wncard(result))],"confinementIntervals":[list(map(float,sp.wnfetd(cnfine,i))) for i in range(sp.wncard(cnfine))]})

    if isinstance(step, StepGeometryGfGfdist):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=step.resultMaxIntervals if step.resultMaxIntervals is not None else max(step.nintvls, 8))
        sp.gfdist(
            step.target,
            step.abcorr,
            step.obsrvr,
            step.relate,
            step.refval,
            step.adjust,
            step.step,
            step.nintvls,
            cnfine,
            result,
        )
        return StepOutput(op=step.op, value={"intervals":[list(map(float,sp.wnfetd(result,i))) for i in range(sp.wncard(result))],"confinementIntervals":[list(map(float,sp.wnfetd(cnfine,i))) for i in range(sp.wncard(cnfine))]})

    return None
