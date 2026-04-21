from __future__ import annotations

from typing import Any, TypeAlias

import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL

from ..models import StepCellsWindowsWnfetd, StepCellsWindowsWninsd, StepOutput, WorkflowStep

WindowStore: TypeAlias = dict[str, Any]


def _get_window(windows: WindowStore, window_id: str, *, max_intervals: int) -> Any:
    existing = windows.get(window_id)
    if existing is not None:
        return existing
    if max_intervals <= 0:
        raise ValueError("maxIntervals must be > 0")
    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    return window


def _require_window(windows: WindowStore, window_id: str) -> Any:
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def run_cells_windows_step(step: WorkflowStep, windows: WindowStore) -> StepOutput | None:
    if isinstance(step, StepCellsWindowsWninsd):
        window = _get_window(windows, step.windowId, max_intervals=step.maxIntervals or 8)
        sp.wninsd(step.left, step.right, window)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepCellsWindowsWnfetd):
        window = _require_window(windows, step.windowId)
        left, right = sp.wnfetd(window, step.index)
        return StepOutput(op=step.op, value={"left": float(left), "right": float(right)})

    return None
