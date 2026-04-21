from __future__ import annotations

from pathlib import Path
from typing import Any

import spiceypy as sp

from ..models import (
    PathRef,
    StepEkEkaclc,
    StepEkEkacld,
    StepEkEkacli,
    StepEkEkcls,
    StepEkEkgc,
    StepEkEkgd,
    StepEkEkffld,
    StepEkEkfind,
    StepEkEkgi,
    StepEkEkifld,
    StepEkEknseg,
    StepEkEkntab,
    StepEkEkopn,
    StepEkEkopr,
    StepEkEkopw,
    StepEkEktnam,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref
from ..runtime.context import EkSegmentState


def _register_handle(context: SidecarRuntimeContext, handle_id: str, native_handle: int) -> None:
    if handle_id in context.state.ek.handles:
        raise ValueError(f"EK handle already exists: {handle_id}")

    context.state.ek.handles[handle_id] = int(native_handle)
    context.register_finalizer(
        f"ek.close_handle:{handle_id}",
        lambda: _close_handle_best_effort(context, handle_id),
    )


def _require_handle(context: SidecarRuntimeContext, handle_id: str) -> int:
    handle = context.state.ek.handles.get(handle_id)
    if handle is None:
        raise ValueError(f"EK handle does not exist: {handle_id}")
    return handle


def _drop_segments_for_handle(context: SidecarRuntimeContext, handle_id: str) -> None:
    stale = [
        segment_id
        for segment_id, segment in context.state.ek.segments.items()
        if segment.handleId == handle_id
    ]
    for segment_id in stale:
        context.state.ek.segments.pop(segment_id, None)


def _close_handle(context: SidecarRuntimeContext, handle_id: str) -> None:
    handle = _require_handle(context, handle_id)
    sp.ekcls(handle)
    context.state.ek.handles.pop(handle_id, None)
    _drop_segments_for_handle(context, handle_id)


def _close_handle_best_effort(context: SidecarRuntimeContext, handle_id: str) -> None:
    handle = context.state.ek.handles.get(handle_id)
    if handle is None:
        return

    try:
        sp.ekcls(handle)
    except BaseException:
        # best-effort cleanup only
        pass

    context.state.ek.handles.pop(handle_id, None)
    _drop_segments_for_handle(context, handle_id)


def _register_segment(context: SidecarRuntimeContext, segment_id: str, segment: EkSegmentState) -> None:
    if segment_id in context.state.ek.segments:
        raise ValueError(f"EK segment already exists: {segment_id}")
    context.state.ek.segments[segment_id] = segment


def _require_segment(context: SidecarRuntimeContext, segment_id: str) -> EkSegmentState:
    segment = context.state.ek.segments.get(segment_id)
    if segment is None:
        raise ValueError(f"EK segment does not exist: {segment_id}")
    return segment


def _normalize_ekgc(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2:
            text, is_null_raw = value
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            return {"found": True, "isNull": False, "value": str(text)}

        if len(value) == 3 and isinstance(value[2], (bool, int)):
            is_null_raw, text, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            return {"found": True, "isNull": False, "value": str(text)}

    raise ValueError(f"Unexpected ekgc return shape: {value!r}")


def _normalize_numeric_get(value: Any, *, fn_name: str) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2:
            number, is_null_raw = value
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            if isinstance(number, bool) or not isinstance(number, (int, float)):
                raise ValueError(f"Unexpected {fn_name} numeric value: {number!r}")
            return {"found": True, "isNull": False, "value": number}

        if len(value) == 3 and isinstance(value[2], (bool, int)):
            number, is_null_raw, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            if isinstance(number, bool) or not isinstance(number, (int, float)):
                raise ValueError(f"Unexpected {fn_name} numeric value: {number!r}")
            return {"found": True, "isNull": False, "value": number}

    raise ValueError(f"Unexpected {fn_name} return shape: {value!r}")


def _cnamelen(values: list[str]) -> int:
    if len(values) == 0:
        return 1
    return max(len(value) for value in values) + 1


def _declen(values: list[str]) -> int:
    if len(values) == 0:
        return 1
    return max(len(value) for value in values) + 1


def _char_vallen(values: list[str]) -> int:
    if len(values) == 0:
        return 1
    return max(max(len(value), 1) for value in values) + 1


def _resolve_ek_path(context: SidecarRuntimeContext, raw_path: str) -> str:
    if Path(raw_path).is_absolute():
        return str(Path(raw_path).resolve())

    return resolve_path_ref(
        context.paths,
        PathRef(kind="scratch", rel=raw_path),
    )


def run_ek_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepEkEkopn):
        resolved_path = _resolve_ek_path(context, step.path)
        Path(resolved_path).parent.mkdir(parents=True, exist_ok=True)
        native_handle = sp.ekopn(resolved_path, step.ifname, step.ncomch)
        _register_handle(context, step.handleId, native_handle)
        return StepOutput(op=step.op, value={"handleId": step.handleId})

    if isinstance(step, StepEkEkopr):
        native_handle = sp.ekopr(_resolve_ek_path(context, step.path))
        _register_handle(context, step.handleId, native_handle)
        return StepOutput(op=step.op, value={"handleId": step.handleId})

    if isinstance(step, StepEkEkopw):
        native_handle = sp.ekopw(_resolve_ek_path(context, step.path))
        _register_handle(context, step.handleId, native_handle)
        return StepOutput(op=step.op, value={"handleId": step.handleId})

    if isinstance(step, StepEkEkcls):
        _close_handle(context, step.handleId)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEkEkntab):
        return StepOutput(op=step.op, value=int(sp.ekntab()))

    if isinstance(step, StepEkEktnam):
        return StepOutput(op=step.op, value=str(sp.ektnam(step.n)))

    if isinstance(step, StepEkEknseg):
        handle = _require_handle(context, step.handleId)
        return StepOutput(op=step.op, value=int(sp.eknseg(handle)))

    if isinstance(step, StepEkEkfind):
        context.state.ek.lastQuery = step.query
        nmrows, error_flag, errmsg = sp.ekfind(step.query)
        if int(error_flag) == 0:
            return StepOutput(op=step.op, value={"ok": True, "nmrows": int(nmrows)})
        return StepOutput(op=step.op, value={"ok": False, "errmsg": str(errmsg)})

    if isinstance(step, StepEkEkgc):
        out = _normalize_ekgc(sp.ekgc(step.selidx, step.row, step.elment))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepEkEkgd):
        out = _normalize_numeric_get(sp.ekgd(step.selidx, step.row, step.elment), fn_name="ekgd")
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepEkEkgi):
        out = _normalize_numeric_get(sp.ekgi(step.selidx, step.row, step.elment), fn_name="ekgi")
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepEkEkifld):
        handle = _require_handle(context, step.handleId)
        segno, rcptrs = sp.ekifld(
            handle,
            step.tabnam,
            len(step.cnames),
            step.nrows,
            _cnamelen(step.cnames),
            step.cnames,
            _declen(step.decls),
            step.decls,
        )
        _register_segment(
            context,
            step.segmentId,
            EkSegmentState(
                handleId=step.handleId,
                segno=int(segno),
                rcptrs=[int(value) for value in rcptrs],
            ),
        )
        return StepOutput(op=step.op, value={"segmentId": step.segmentId})

    if isinstance(step, StepEkEkacli):
        segment = _require_segment(context, step.segmentId)
        handle = _require_handle(context, segment.handleId)
        nrows = len(segment.rcptrs)
        sp.ekacli(
            handle,
            segment.segno,
            step.column,
            step.ivals,
            step.entszs,
            step.nlflgs,
            segment.rcptrs,
            [0] * nrows,
        )
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEkEkacld):
        segment = _require_segment(context, step.segmentId)
        handle = _require_handle(context, segment.handleId)
        nrows = len(segment.rcptrs)
        sp.ekacld(
            handle,
            segment.segno,
            step.column,
            step.dvals,
            step.entszs,
            step.nlflgs,
            segment.rcptrs,
            [0] * nrows,
        )
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEkEkaclc):
        segment = _require_segment(context, step.segmentId)
        handle = _require_handle(context, segment.handleId)
        nrows = len(segment.rcptrs)
        sp.ekaclc(
            handle,
            segment.segno,
            step.column,
            _char_vallen(step.cvals),
            step.cvals,
            step.entszs,
            step.nlflgs,
            segment.rcptrs,
            [0] * nrows,
        )
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEkEkffld):
        segment = _require_segment(context, step.segmentId)
        handle = _require_handle(context, segment.handleId)
        sp.ekffld(handle, segment.segno, segment.rcptrs)
        return StepOutput(op=step.op, value=None)

    return None
