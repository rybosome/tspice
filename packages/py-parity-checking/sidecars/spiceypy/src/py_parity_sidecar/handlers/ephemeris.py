from __future__ import annotations

from pathlib import Path
from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError
from spiceypy.utils.support_types import SPICEDOUBLE_CELL, SPICEINT_CELL

from ..models import (
    StepEphemerisSpkcls,
    StepEphemerisSpkcov,
    StepEphemerisSpkez,
    StepEphemerisSpkezp,
    StepEphemerisSpkezr,
    StepEphemerisSpkgeo,
    StepEphemerisSpkgps,
    StepEphemerisSpkobj,
    StepEphemerisSpkopa,
    StepEphemerisSpkopn,
    StepEphemerisSpkpds,
    StepEphemerisSpkpos,
    StepEphemerisSpksfs,
    StepEphemerisSpkssb,
    StepEphemerisSpkuds,
    StepEphemerisSpkw08,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref


def _to_float(value: Any, *, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be numeric")
    return float(value)


def _to_float_list(value: Any, *, expected_len: int, label: str) -> list[float]:
    if not hasattr(value, "__iter__"):
        raise TypeError(f"{label} must be iterable")

    out = [_to_float(item, label=f"{label}[{idx}]") for idx, item in enumerate(value)]
    if len(out) != expected_len:
        raise ValueError(f"{label} must have length {expected_len}, got {len(out)}")
    return out


def _normalize_state_lt(value: Any, *, label: str) -> tuple[list[float], float]:
    if not isinstance(value, tuple) or len(value) != 2:
        raise ValueError(f"Unexpected {label} return shape: {value!r}")
    state_raw, lt_raw = value
    state = _to_float_list(state_raw, expected_len=6, label=f"{label}.state")
    lt = _to_float(lt_raw, label=f"{label}.lt")
    return state, lt


def _normalize_pos_lt(value: Any, *, label: str) -> tuple[list[float], float]:
    if not isinstance(value, tuple) or len(value) != 2:
        raise ValueError(f"Unexpected {label} return shape: {value!r}")
    pos_raw, lt_raw = value
    pos = _to_float_list(pos_raw, expected_len=3, label=f"{label}.pos")
    lt = _to_float(lt_raw, label=f"{label}.lt")
    return pos, lt


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


def _get_int_cell(context: SidecarRuntimeContext, cell_id: str, *, max_cardinality: int) -> Any:
    cells = context.state.ephemeris.intCells
    existing = cells.get(cell_id)
    if existing is not None:
        return existing

    if max_cardinality <= 0:
        raise ValueError("maxCardinality must be > 0")

    cell = SPICEINT_CELL(max_cardinality)
    cells[cell_id] = cell
    context.register_finalizer(
        f"ephemeris.releaseIntCell:{cell_id}",
        lambda: context.state.ephemeris.intCells.pop(cell_id, None),
    )
    return cell


def _require_spk_handle(context: SidecarRuntimeContext, handle_id: str) -> int:
    handle = context.state.ephemeris.spkHandles.get(handle_id)
    if handle is None:
        raise ValueError(f"SPK handle does not exist: {handle_id}")
    return handle


def _resolve_path(context: SidecarRuntimeContext, path_ref_input: Any) -> str:
    return resolve_path_ref(context.paths, path_ref_input)


def _close_spk_handle_best_effort(handle: int) -> None:
    try:
        sp.spkcls(handle)
    except BaseException:
        # best-effort cleanup only
        pass


def _set_spk_handle(context: SidecarRuntimeContext, handle_id: str, handle: int) -> None:
    existing = context.state.ephemeris.spkHandles.get(handle_id)
    if existing is not None and existing != handle:
        _close_spk_handle_best_effort(existing)

    context.state.ephemeris.spkHandles[handle_id] = handle

    def _finalize() -> None:
        current = context.state.ephemeris.spkHandles.get(handle_id)
        if current is None or current != handle:
            return
        _close_spk_handle_best_effort(handle)
        context.state.ephemeris.spkHandles.pop(handle_id, None)

    context.register_finalizer(f"ephemeris.spkcls:{handle_id}:{handle}", _finalize)


def _normalize_spksfs_result(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4:
            _handle, descr, ident, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "descr": _to_float_list(descr, expected_len=5, label="spksfs.descr"),
                "ident": str(ident),
            }

        if len(value) == 3:
            _handle, descr, ident = value
            return {
                "found": True,
                "descr": _to_float_list(descr, expected_len=5, label="spksfs.descr"),
                "ident": str(ident),
            }

    raise ValueError(f"Unexpected spksfs return shape: {value!r}")


def run_ephemeris_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepEphemerisSpkcls):
        handle = _require_spk_handle(context, step.handleId)
        sp.spkcls(handle)
        context.state.ephemeris.spkHandles.pop(step.handleId, None)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEphemerisSpkcov):
        cover = _get_window(
            context,
            step.coverWindowId,
            max_intervals=step.maxIntervals if step.maxIntervals is not None else 16,
        )
        sp.spkcov(_resolve_path(context, step.spk), step.idcode, cover)
        interval_count = int(sp.wncard(cover))
        intervals: list[list[float]] = []
        for idx in range(interval_count):
            left, right = sp.wnfetd(cover, idx)
            intervals.append([float(left), float(right)])
        return StepOutput(op=step.op, value={"intervals": intervals})

    if isinstance(step, StepEphemerisSpkez):
        state, lt = _normalize_state_lt(
            sp.spkez(step.target, step.et, step.ref, step.abcorr, step.observer),
            label="spkez",
        )
        context.state.ephemeris.requestedTargets.add(step.target)
        return StepOutput(op=step.op, value={"state": state, "lt": lt})

    if isinstance(step, StepEphemerisSpkezp):
        pos, lt = _normalize_pos_lt(
            sp.spkezp(step.target, step.et, step.ref, step.abcorr, step.observer),
            label="spkezp",
        )
        context.state.ephemeris.requestedTargets.add(step.target)
        return StepOutput(op=step.op, value={"pos": pos, "lt": lt})

    if isinstance(step, StepEphemerisSpkezr):
        state, lt = _normalize_state_lt(
            sp.spkezr(step.target, step.et, step.ref, step.abcorr, step.observer),
            label="spkezr",
        )
        return StepOutput(op=step.op, value={"state": state, "lt": lt})

    if isinstance(step, StepEphemerisSpkgeo):
        state, lt = _normalize_state_lt(
            sp.spkgeo(step.target, step.et, step.ref, step.observer),
            label="spkgeo",
        )
        context.state.ephemeris.requestedTargets.add(step.target)
        return StepOutput(op=step.op, value={"state": state, "lt": lt})

    if isinstance(step, StepEphemerisSpkgps):
        pos, lt = _normalize_pos_lt(
            sp.spkgps(step.target, step.et, step.ref, step.observer),
            label="spkgps",
        )
        context.state.ephemeris.requestedTargets.add(step.target)
        return StepOutput(op=step.op, value={"pos": pos, "lt": lt})

    if isinstance(step, StepEphemerisSpkobj):
        ids_cell = _get_int_cell(
            context,
            step.idsCellId,
            max_cardinality=step.maxCardinality if step.maxCardinality is not None else 1024,
        )
        sp.spkobj(_resolve_path(context, step.spk), ids_cell)
        ids = [int(value) for value in ids_cell]
        return StepOutput(op=step.op, value={"ids": ids})

    if isinstance(step, StepEphemerisSpkopa):
        handle = int(sp.spkopa(_resolve_path(context, step.file)))
        _set_spk_handle(context, step.handleId, handle)
        return StepOutput(op=step.op, value={"handleId": step.handleId})

    if isinstance(step, StepEphemerisSpkopn):
        output_path = Path(_resolve_path(context, step.file))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        handle = int(sp.spkopn(str(output_path), step.ifname, step.ncomch))
        _set_spk_handle(context, step.handleId, handle)
        return StepOutput(op=step.op, value={"handleId": step.handleId})

    if isinstance(step, StepEphemerisSpkpds):
        packed = _to_float_list(
            sp.spkpds(step.body, step.center, step.frame, step.type, step.first, step.last),
            expected_len=5,
            label="spkpds",
        )
        return StepOutput(op=step.op, value=packed)

    if isinstance(step, StepEphemerisSpkpos):
        pos, lt = _normalize_pos_lt(
            sp.spkpos(step.target, step.et, step.ref, step.abcorr, step.observer),
            label="spkpos",
        )
        return StepOutput(op=step.op, value={"pos": pos, "lt": lt})

    if isinstance(step, StepEphemerisSpksfs):
        try:
            out = _normalize_spksfs_result(sp.spksfs(step.body, step.et, 256))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepEphemerisSpkssb):
        state = _to_float_list(sp.spkssb(step.target, step.et, step.ref), expected_len=6, label="spkssb")
        context.state.ephemeris.requestedTargets.add(step.target)
        return StepOutput(op=step.op, value=state)

    if isinstance(step, StepEphemerisSpkuds):
        body, center, frame, typenum, first, last, baddr, eaddr = sp.spkuds(step.descr)
        return StepOutput(
            op=step.op,
            value={
                "body": int(body),
                "center": int(center),
                "frame": int(frame),
                "type": int(typenum),
                "first": float(first),
                "last": float(last),
                "baddr": int(baddr),
                "eaddr": int(eaddr),
            },
        )

    if isinstance(step, StepEphemerisSpkw08):
        handle = _require_spk_handle(context, step.handleId)
        if len(step.states) == 0 or len(step.states) % 6 != 0:
            raise ValueError("spkw08.states must be a non-empty flat list whose length is a multiple of 6")

        state_records = [step.states[idx : idx + 6] for idx in range(0, len(step.states), 6)]
        sp.spkw08(
            handle,
            step.body,
            step.center,
            step.frame,
            step.first,
            step.last,
            step.segid,
            step.degree,
            len(state_records),
            state_records,
            step.epoch1,
            step.step,
        )
        return StepOutput(op=step.op, value=None)

    return None
