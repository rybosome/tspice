from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from typing import Any, Iterator

import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL

from ..models import (
    StepGeometryGfGfdist,
    StepGeometryGfGfrefn,
    StepGeometryGfGfrepf,
    StepGeometryGfGfrepi,
    StepGeometryGfGfsep,
    StepGeometryGfGfsstp,
    StepGeometryGfGfstep,
    StepGeometryGfGfstol,
    StepOutput,
    WorkflowStep,
)
from .cells_windows import WindowStore


def _require_window(windows: WindowStore, window_id: str) -> Any:
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def _get_or_create_window(windows: WindowStore, window_id: str, *, max_intervals: int) -> Any:
    existing = windows.get(window_id)
    if existing is not None:
        return existing
    if max_intervals <= 0:
        raise ValueError("maxIntervals must be > 0")

    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    return window


@contextmanager
def _suppress_native_stdout() -> Iterator[None]:
    """Temporarily redirect FD1 to preserve sidecar JSON stdout protocol."""
    try:
        sys.stdout.flush()
    except BaseException:
        pass

    saved_stdout_fd = os.dup(1)
    try:
        with open(os.devnull, "w", encoding="utf-8") as devnull:
            os.dup2(devnull.fileno(), 1)
            yield
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

    if isinstance(step, StepGeometryGfGfsep):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=max(step.nintvls, 8))
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
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepGeometryGfGfdist):
        cnfine = _require_window(windows, step.cnfineWindowId)
        result = _get_or_create_window(windows, step.resultWindowId, max_intervals=max(step.nintvls, 8))
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
        return StepOutput(op=step.op, value=None)

    return None
