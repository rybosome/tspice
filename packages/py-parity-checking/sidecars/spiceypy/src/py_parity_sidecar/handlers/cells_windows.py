from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL

from ..models import StepCellsWindowsWnfetd, StepCellsWindowsWninsd, StepOutput, WorkflowStep
from ..runtime import SidecarRuntimeContext


def _get_window(context: SidecarRuntimeContext, window_id: str, *, max_intervals: int) -> Any:
    windows = context.state.cellsWindows.windows
    existing = windows.get(window_id)
    if existing is not None:
        return existing

    if max_intervals <= 0:
        raise ValueError("maxIntervals must be > 0")

    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    context.register_finalizer(
        f"cellsWindows.release:{window_id}",
        lambda: context.state.cellsWindows.windows.pop(window_id, None),
    )
    return window


def _require_window(context: SidecarRuntimeContext, window_id: str) -> Any:
    windows = context.state.cellsWindows.windows
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def run_cells_windows_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepCellsWindowsWninsd):
        window = _get_window(context, step.windowId, max_intervals=step.maxIntervals or 8)
        sp.wninsd(step.left, step.right, window)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepCellsWindowsWnfetd):
        window = _require_window(context, step.windowId)
        left, right = sp.wnfetd(window, step.index)
        return StepOutput(op=step.op, value={"left": float(left), "right": float(right)})

    return None
