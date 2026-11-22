from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.support_types import SPICECHAR_CELL, SPICEDOUBLE_CELL, SPICEINT_CELL, SpiceCell

from .. import set_algebra_oracle
from .. import cell_array_oracle
from .. import window_algebra_oracle
from ..models import (
    StepCellsWindowsCard,
    StepCellsWindowsAppndc,
    StepCellsWindowsAppndd,
    StepCellsWindowsAppndi,
    StepCellsWindowsSetResult,
    StepCellsWindowsSet,
    StepCellsWindowsRemovc,
    StepCellsWindowsRemovd,
    StepCellsWindowsRemovi,
    StepCellsWindowsOrdc,
    StepCellsWindowsOrdd,
    StepCellsWindowsOrdi,
    StepCellsWindowsCopy,
    StepCellsWindowsElemc,
    StepCellsWindowsElemd,
    StepCellsWindowsElemi,
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
    StepCellsWindowsWncomd,
    StepCellsWindowsWncond,
    StepCellsWindowsWndifd,
    StepCellsWindowsWnelmd,
    StepCellsWindowsWnexpd,
    StepCellsWindowsWnextd,
    StepCellsWindowsWnfild,
    StepCellsWindowsWnfltd,
    StepCellsWindowsWnincd,
    StepCellsWindowsWnintd,
    StepCellsWindowsWnreld,
    StepCellsWindowsWnsumd,
    StepCellsWindowsWnunid,
    StepCellsWindowsWnvald,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext


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


def _get_or_create_window(context: SidecarRuntimeContext, window_id: str, *, max_intervals: int) -> SpiceCell:
    windows = context.state.cellsWindows.windows
    existing = windows.get(window_id)
    if existing is not None:
        return existing

    window = window_algebra_oracle.allocate_window(max_intervals)
    windows[window_id] = window
    context.register_finalizer(
        f"cellsWindows.releaseWindow:{window_id}",
        lambda: context.state.cellsWindows.windows.pop(window_id, None),
    )
    return window


def _require_window(context: SidecarRuntimeContext, window_id: str) -> SpiceCell:
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


def _require_even_window(context: SidecarRuntimeContext, window_id: str) -> SpiceCell:
    window = _require_window(context, window_id)
    window_algebra_oracle.validate_input(window)
    return window


def _snapshot_window(window: SpiceCell) -> list[dict[str, float]]:
    intervals = (sp.wnfetd(window, index) for index in range(sp.wncard(window)))
    return [{"left": float(left), "right": float(right)} for left, right in intervals]


def run_cells_windows_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepCellsWindowsCard):
        target = _require_target(context, step.targetKind, step.targetId)
        return StepOutput(op=step.op, value=int(sp.card(target)))

    if isinstance(step, StepCellsWindowsAppndc):
        cell = _get_or_create_char_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality, length=32 if step.length is None else step.length)
        cell_array_oracle.check_text(step.item, cell, append=True)
        sp.appndc(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsAppndd):
        cell = _get_or_create_double_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        sp.appndd(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsAppndi):
        cell = _get_or_create_int_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        if not -(2**31) <= step.item < 2**31:
            raise ValueError("cell item exceeds SpiceInt")
        sp.appndi(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsSetResult):
        a = _require_target(context, step.kind, step.aId)
        b = _require_target(context, step.kind, step.bId)
        cap = 8 if step.maxCardinality is None else step.maxCardinality
        if step.kind == "int":
            target = _get_or_create_int_cell(context, step.resultId, max_cardinality=cap)
        elif step.kind == "double":
            target = _get_or_create_double_cell(context, step.resultId, max_cardinality=cap)
        else:
            target = _get_or_create_char_cell(context, step.resultId, max_cardinality=cap, length=32 if step.length is None else step.length)
        set_algebra_oracle.write_result(step.op, a, b, target)
        return StepOutput(op=step.op, value=list(target))

    if isinstance(step, StepCellsWindowsSet):
        a = _require_target(context, step.kind, step.aId)
        b = _require_target(context, step.kind, step.bId)
        cell_array_oracle.check_text(step.relation, a)
        set_algebra_oracle.check_inputs(a, b)
        return StepOutput(op=step.op, value=bool(sp.set_c(a, step.relation, b)))

    if isinstance(step, StepCellsWindowsRemovc):
        cell = _get_or_create_char_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality, length=32 if step.length is None else step.length)
        cell_array_oracle.check_text(step.item, cell)
        sp.removc(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsRemovd):
        cell = _get_or_create_double_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        sp.removd(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsRemovi):
        cell = _get_or_create_int_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        if not -(2**31) <= step.item < 2**31:
            raise ValueError("cell item exceeds SpiceInt")
        sp.removi(step.item, cell)
        return StepOutput(op=step.op, value=list(cell))

    if isinstance(step, StepCellsWindowsOrdc):
        cell = _get_or_create_char_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality, length=32 if step.length is None else step.length)
        cell_array_oracle.check_text(step.item, cell)
        return StepOutput(op=step.op, value=int(sp.ordc(step.item, cell)))

    if isinstance(step, StepCellsWindowsOrdd):
        cell = _get_or_create_double_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        return StepOutput(op=step.op, value=int(sp.ordd(step.item, cell)))

    if isinstance(step, StepCellsWindowsOrdi):
        cell = _get_or_create_int_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        if not -(2**31) <= step.item < 2**31:
            raise ValueError("cell item exceeds SpiceInt")
        return StepOutput(op=step.op, value=int(sp.ordi(step.item, cell)))

    if isinstance(step, StepCellsWindowsCopy):
        source = _require_target(context, step.kind, step.sourceId)
        cap = 8 if step.maxCardinality is None else step.maxCardinality
        if step.kind == "int":
            target = _get_or_create_int_cell(context, step.resultId, max_cardinality=cap)
        elif step.kind == "double":
            target = _get_or_create_double_cell(context, step.resultId, max_cardinality=cap)
        else:
            target = _get_or_create_char_cell(context, step.resultId, max_cardinality=cap, length=32 if step.length is None else step.length)
        cell_array_oracle.copy_cell(source, target)
        return StepOutput(op=step.op, value=list(target))

    if isinstance(step, StepCellsWindowsElemc):
        cell = _get_or_create_char_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality, length=32 if step.length is None else step.length)
        cell_array_oracle.check_text(step.item, cell)
        return StepOutput(op=step.op, value=bool(sp.elemc(step.item, cell)))

    if isinstance(step, StepCellsWindowsElemd):
        cell = _get_or_create_double_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        return StepOutput(op=step.op, value=bool(sp.elemd(step.item, cell)))

    if isinstance(step, StepCellsWindowsElemi):
        cell = _get_or_create_int_cell(context, step.cellId, max_cardinality=8 if step.maxCardinality is None else step.maxCardinality)
        if not -(2**31) <= step.item < 2**31:
            raise ValueError("cell item exceeds SpiceInt")
        return StepOutput(op=step.op, value=bool(sp.elemi(step.item, cell)))

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
        if isinstance(target, window_algebra_oracle.OracleWindow):
            window_algebra_oracle.check_resize(target, step.size)
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

    if isinstance(step, StepCellsWindowsWncomd):
        window = _require_window(context, step.windowId)
        result = _get_or_create_window(context, step.resultId, max_intervals=step.maxIntervals)
        window_algebra_oracle.wncomd(step.left, step.right, window, result)
        return StepOutput(op=step.op, value=_snapshot_window(result))

    if isinstance(step, StepCellsWindowsWncond):
        window = _require_even_window(context, step.windowId)
        sp.wncond(step.left, step.right, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    if isinstance(step, StepCellsWindowsWndifd):
        a = _require_window(context, step.aId)
        b = _require_window(context, step.bId)
        result = _get_or_create_window(context, step.resultId, max_intervals=step.maxIntervals)
        window_algebra_oracle.wndifd(a, b, result)
        return StepOutput(op=step.op, value=_snapshot_window(result))

    if isinstance(step, StepCellsWindowsWnelmd):
        window = _require_even_window(context, step.windowId)
        return StepOutput(op=step.op, value=sp.wnelmd(step.point, window))

    if isinstance(step, StepCellsWindowsWnexpd):
        window = _require_even_window(context, step.windowId)
        sp.wnexpd(step.left, step.right, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    if isinstance(step, StepCellsWindowsWnextd):
        window = _require_even_window(context, step.windowId)
        window_algebra_oracle.wnextd(step.side, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    if isinstance(step, StepCellsWindowsWnfild):
        window = _require_even_window(context, step.windowId)
        sp.wnfild(step.small, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    if isinstance(step, StepCellsWindowsWnfltd):
        window = _require_even_window(context, step.windowId)
        sp.wnfltd(step.small, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    if isinstance(step, StepCellsWindowsWnincd):
        window = _require_even_window(context, step.windowId)
        return StepOutput(op=step.op, value=sp.wnincd(step.left, step.right, window))

    if isinstance(step, StepCellsWindowsWnintd):
        a = _require_window(context, step.aId)
        b = _require_window(context, step.bId)
        result = _get_or_create_window(context, step.resultId, max_intervals=step.maxIntervals)
        window_algebra_oracle.wnintd(a, b, result)
        return StepOutput(op=step.op, value=_snapshot_window(result))

    if isinstance(step, StepCellsWindowsWnreld):
        a = _require_even_window(context, step.aId)
        b = _require_even_window(context, step.bId)
        if "\x00" in step.relation:
            raise ValueError("Relation must be a NUL-free C string")
        return StepOutput(op=step.op, value=sp.wnreld(a, step.relation, b))

    if isinstance(step, StepCellsWindowsWnsumd):
        window = _require_window(context, step.windowId)
        # Odd cardinality has a documented pre-read check in WNSUMD itself.
        if not sp.card(window) % 2:
            window_algebra_oracle.validate_input(window)
        meas, avg, stddev, shortest, longest = sp.wnsumd(window)
        return StepOutput(op=step.op, value={
            "meas": meas, "avg": avg, "stddev": stddev, "shortest": shortest, "longest": longest,
        })

    if isinstance(step, StepCellsWindowsWnunid):
        a = _require_window(context, step.aId)
        b = _require_window(context, step.bId)
        result = _get_or_create_window(context, step.resultId, max_intervals=step.maxIntervals)
        window_algebra_oracle.wnunid(a, b, result)
        return StepOutput(op=step.op, value=_snapshot_window(result))

    if isinstance(step, StepCellsWindowsWnvald):
        window = _require_window(context, step.windowId)
        sp.wnvald(step.size, step.n, window)
        return StepOutput(op=step.op, value=_snapshot_window(window))

    return None
