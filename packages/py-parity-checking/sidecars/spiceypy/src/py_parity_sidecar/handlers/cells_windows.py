from __future__ import annotations

import ctypes as ct
from typing import Any

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SPICECHAR_CELL, SPICEDOUBLE_CELL, SPICEINT_CELL, SpiceCell

from ..models import (
    StepCellsWindowsCard,
    StepCellsWindowsLparss,
    StepCellsWindowsInsrtc,
    StepCellsWindowsInsrtd,
    StepCellsWindowsInsrti,
    StepCellsWindowsScard,
    StepCellsWindowsSize,
    StepCellsWindowsSsize,
    StepCellsWindowsValid,
    StepCellsWindowsWncard,
    StepCellsWindowsWnfetd,
    StepCellsWindowsWninsd,
    StepCellsWindowsWnvald,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext


# Use a private ctypes binding so declaring the ABI does not change SpiceyPy's helper.
_lparss = ct.CDLL(libspice._name).lparss_c
_lparss.argtypes = [ct.c_char_p, ct.c_char_p, ct.POINTER(SpiceCell)]
_lparss.restype = None


def _get_or_create_int_cell(
    context: SidecarRuntimeContext,
    cell_id: str,
    *,
    max_cardinality: int,
) -> Any:
    int_cells = context.state.cellsWindows.intCells
    existing = int_cells.get(cell_id)
    if existing is not None:
        return existing

    if max_cardinality < 0:
        raise ValueError("maxCardinality must be >= 0")

    cell = SPICEINT_CELL(max_cardinality)
    int_cells[cell_id] = cell
    context.register_finalizer(
        f"cellsWindows.releaseIntCell:{cell_id}",
        lambda: context.state.cellsWindows.intCells.pop(cell_id, None),
    )
    return cell


def _require_int_cell(context: SidecarRuntimeContext, cell_id: str) -> Any:
    int_cells = context.state.cellsWindows.intCells
    cell = int_cells.get(cell_id)
    if cell is None:
        raise ValueError(f"Int cell does not exist: {cell_id}")
    return cell


def _get_or_create_double_cell(
    context: SidecarRuntimeContext,
    cell_id: str,
    *,
    max_cardinality: int,
) -> Any:
    double_cells = context.state.cellsWindows.doubleCells
    existing = double_cells.get(cell_id)
    if existing is not None:
        return existing

    if max_cardinality < 0:
        raise ValueError("maxCardinality must be >= 0")

    cell = SPICEDOUBLE_CELL(max_cardinality)
    double_cells[cell_id] = cell
    context.register_finalizer(
        f"cellsWindows.releaseDoubleCell:{cell_id}",
        lambda: context.state.cellsWindows.doubleCells.pop(cell_id, None),
    )
    return cell


def _require_double_cell(context: SidecarRuntimeContext, cell_id: str) -> Any:
    double_cells = context.state.cellsWindows.doubleCells
    cell = double_cells.get(cell_id)
    if cell is None:
        raise ValueError(f"Double cell does not exist: {cell_id}")
    return cell


def _get_or_create_char_cell(
    context: SidecarRuntimeContext,
    cell_id: str,
    *,
    max_cardinality: int,
    length: int,
) -> Any:
    char_cells = context.state.cellsWindows.charCells
    existing = char_cells.get(cell_id)
    if existing is not None:
        return existing

    if max_cardinality < 0:
        raise ValueError("maxCardinality must be >= 0")

    if length <= 0:
        raise ValueError("length must be > 0")

    cell = SPICECHAR_CELL(max_cardinality, length)
    char_cells[cell_id] = cell
    context.register_finalizer(
        f"cellsWindows.releaseCharCell:{cell_id}",
        lambda: context.state.cellsWindows.charCells.pop(cell_id, None),
    )
    return cell


def _require_char_cell(context: SidecarRuntimeContext, cell_id: str) -> Any:
    char_cells = context.state.cellsWindows.charCells
    cell = char_cells.get(cell_id)
    if cell is None:
        raise ValueError(f"Char cell does not exist: {cell_id}")
    return cell


def _get_or_create_window(context: SidecarRuntimeContext, window_id: str, *, max_intervals: int) -> Any:
    windows = context.state.cellsWindows.windows
    existing = windows.get(window_id)
    if existing is not None:
        return existing

    if max_intervals < 0:
        raise ValueError("maxIntervals must be >= 0")

    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    context.register_finalizer(
        f"cellsWindows.releaseWindow:{window_id}",
        lambda: context.state.cellsWindows.windows.pop(window_id, None),
    )
    return window


def _require_window(context: SidecarRuntimeContext, window_id: str) -> Any:
    windows = context.state.cellsWindows.windows
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def _require_target(context: SidecarRuntimeContext, target_kind: str, target_id: str) -> Any:
    if target_kind == "int":
        return _require_int_cell(context, target_id)

    if target_kind == "double":
        return _require_double_cell(context, target_id)

    if target_kind == "char":
        return _require_char_cell(context, target_id)

    if target_kind == "window":
        return _require_window(context, target_id)

    raise ValueError(f"Unsupported cells-windows targetKind: {target_kind}")


def run_cells_windows_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepCellsWindowsCard):
        target = _require_target(context, step.targetKind, step.targetId)
        return StepOutput(op=step.op, value=int(sp.card(target)))

    if isinstance(step, StepCellsWindowsLparss):
        # The locked high-level helper always creates a new cell. Call its
        # typed canonical symbol on the actual workflow-owned persistent cell.
        if not 0 <= step.maxCardinality <= 4096 or not 1 <= step.length <= 1024:
            raise ValueError("LPARSS fixture cell exceeds the oracle workspace range")
        data, delimiters = step.list.encode("utf-8"), step.delims.encode("utf-8")
        if b"\x00" in data or b"\x00" in delimiters:
            raise ValueError("LPARSS text cannot contain an embedded NUL")
        cell = _get_or_create_char_cell(context, step.cellId, max_cardinality=step.maxCardinality, length=step.length)
        _lparss(data, delimiters, ct.byref(cell))
        sp.check_for_spice_error(None)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsInsrtc):
        cell = _get_or_create_char_cell(
            context,
            step.cellId,
            max_cardinality=8 if step.maxCardinality is None else step.maxCardinality,
            length=32 if step.length is None else step.length,
        )
        sp.insrtc(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsInsrtd):
        cell = _get_or_create_double_cell(
            context,
            step.cellId,
            max_cardinality=8 if step.maxCardinality is None else step.maxCardinality,
        )
        sp.insrtd(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsInsrti):
        cell = _get_or_create_int_cell(
            context,
            step.cellId,
            max_cardinality=8 if step.maxCardinality is None else step.maxCardinality,
        )
        sp.insrti(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsScard):
        target = _require_target(context, step.targetKind, step.targetId)
        sp.scard(step.card, target)
        return StepOutput(op=step.op, value=int(sp.card(target)))

    if isinstance(step, StepCellsWindowsSize):
        target = _require_target(context, step.targetKind, step.targetId)
        return StepOutput(op=step.op, value=int(sp.size(target)))

    if isinstance(step, StepCellsWindowsSsize):
        target = _require_target(context, step.targetKind, step.targetId)
        sp.ssize(step.size, target)
        return StepOutput(op=step.op, value={"size": int(sp.size(target)), "card": int(sp.card(target))})

    if isinstance(step, StepCellsWindowsValid):
        target = _require_target(context, step.targetKind, step.targetId)
        sp.valid(step.size, step.n, target)
        return StepOutput(op=step.op, value=None if step.targetKind == "window" else list(target))

    if isinstance(step, StepCellsWindowsWncard):
        window = _require_window(context, step.windowId)
        return StepOutput(op=step.op, value=int(sp.wncard(window)))

    if isinstance(step, StepCellsWindowsWninsd):
        window = _get_or_create_window(context, step.windowId, max_intervals=8 if step.maxIntervals is None else step.maxIntervals)
        sp.wninsd(step.left, step.right, window)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepCellsWindowsWnfetd):
        window = _require_window(context, step.windowId)
        left, right = sp.wnfetd(window, step.index)
        return StepOutput(op=step.op, value={"left": float(left), "right": float(right)})

    if isinstance(step, StepCellsWindowsWnvald):
        window = _require_window(context, step.windowId)
        sp.wnvald(step.size, step.n, window)
        intervals = [sp.wnfetd(window, i) for i in range(sp.wncard(window))]
        return StepOutput(op=step.op, value=[{"left": float(left), "right": float(right)} for left, right in intervals])

    return None
