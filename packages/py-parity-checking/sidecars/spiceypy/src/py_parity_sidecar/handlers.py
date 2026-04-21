from __future__ import annotations

from pathlib import Path
from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError
from spiceypy.utils.support_types import SPICEDOUBLE_CELL

from .models import (
    CaseRequest,
    StepCellsWindowsWnfetd,
    StepCellsWindowsWninsd,
    StepCoordsVectorsMxm,
    StepCoordsVectorsRecgeo,
    StepEkEkgc,
    StepEkEkfind,
    StepIdsNamesBodn2c,
    StepKernelPoolGcpool,
    StepKernelsFurnsh,
    StepKernelsKdata,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepOutput,
    StepTimeEt2Utc,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    WorkflowStep,
)


def _basename(path_value: str) -> str:
    if path_value.strip() == "":
        return ""
    return Path(path_value).name


def _get_window(
    windows: dict[str, Any],
    window_id: str,
    *,
    max_intervals: int,
) -> Any:
    existing = windows.get(window_id)
    if existing is not None:
        return existing
    if max_intervals <= 0:
        raise ValueError("maxIntervals must be > 0")
    window = SPICEDOUBLE_CELL(max_intervals * 2)
    windows[window_id] = window
    return window


def _require_window(windows: dict[str, Any], window_id: str) -> Any:
    window = windows.get(window_id)
    if window is None:
        raise ValueError(f"Window does not exist: {window_id}")
    return window


def _normalize_bodn2c(value: Any) -> dict[str, int | bool]:
    if isinstance(value, tuple):
        if len(value) == 2:
            code_raw, found_raw = value
            found = bool(found_raw)
            if found:
                return {"found": True, "code": int(code_raw)}
            return {"found": False}
        raise ValueError(f"Unexpected bodn2c tuple shape: {value!r}")
    return {"found": True, "code": int(value)}


def _normalize_found_list(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2 and isinstance(value[1], (bool, int)):
            values_raw, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {"found": True, "values": [str(item) for item in values_raw]}
    return {"found": True, "values": [str(item) for item in value]}


def _normalize_kdata(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 5:
            file, filtyp, source, _handle, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "file": _basename(str(file)),
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }
        if len(value) == 4:
            file, filtyp, source, _handle = value
            return {
                "found": True,
                "file": _basename(str(file)),
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }
    raise ValueError(f"Unexpected kdata return shape: {value!r}")


def _normalize_kxtrct(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 3 and isinstance(value[2], (bool, int)):
            wordsq, substr, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {"found": True, "wordsq": str(wordsq), "substr": str(substr)}
        if len(value) == 2:
            wordsq, substr = value
            return {"found": True, "wordsq": str(wordsq), "substr": str(substr)}
    raise ValueError(f"Unexpected kxtrct return shape: {value!r}")


def _normalize_ekgc(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2:
            text, is_null_raw = value
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            return {"found": True, "isNull": False, "value": str(text)}
        if len(value) == 3:
            first, second, third = value
            if isinstance(third, (bool, int)):
                found = bool(third)
                if not found:
                    return {"found": False}
                is_null = bool(first)
                if is_null:
                    return {"found": True, "isNull": True}
                return {"found": True, "isNull": False, "value": str(second)}
    raise ValueError(f"Unexpected ekgc return shape: {value!r}")


def _run_step(step: WorkflowStep, windows: dict[str, Any]) -> StepOutput:
    if isinstance(step, StepTimeStr2Et):
        et = float(sp.str2et(step.time))
        return StepOutput(op=step.op, value=et)

    if isinstance(step, StepTimeEt2Utc):
        utc = str(sp.et2utc(step.et, step.format, step.prec))
        return StepOutput(op=step.op, value=utc)

    if isinstance(step, StepTimeTimdefGet):
        value = sp.timdef("GET", step.item, 256)
        return StepOutput(op=step.op, value=str(value))

    if isinstance(step, StepTimeTimdefSet):
        sp.timdef("SET", step.item, 256, step.value)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepIdsNamesBodn2c):
        try:
            out = _normalize_bodn2c(sp.bodn2c(step.name))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepCoordsVectorsMxm):
        out = sp.mxm(step.m1, step.m2)
        return StepOutput(op=step.op, value=[[float(v) for v in row] for row in out.tolist()])

    if isinstance(step, StepCoordsVectorsRecgeo):
        lon, lat, alt = sp.recgeo(step.rectan, step.re, step.f)
        return StepOutput(op=step.op, value={"lon": float(lon), "lat": float(lat), "alt": float(alt)})

    if isinstance(step, StepCellsWindowsWninsd):
        window = _get_window(windows, step.windowId, max_intervals=step.maxIntervals or 8)
        sp.wninsd(step.left, step.right, window)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepCellsWindowsWnfetd):
        window = _require_window(windows, step.windowId)
        left, right = sp.wnfetd(window, step.index)
        return StepOutput(op=step.op, value={"left": float(left), "right": float(right)})

    if isinstance(step, StepKernelPoolGcpool):
        try:
            out = _normalize_found_list(sp.gcpool(step.name, step.start, step.room))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelsFurnsh):
        sp.furnsh(step.file)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelsKtotal):
        total = int(sp.ktotal(step.kind))
        return StepOutput(op=step.op, value=total)

    if isinstance(step, StepKernelsKdata):
        try:
            out = _normalize_kdata(sp.kdata(step.which, step.kind))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelsKxtrct):
        try:
            out = _normalize_kxtrct(sp.kxtrct(step.keywd, step.terms, len(step.terms), step.string))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepEkEkfind):
        nmrows, error_flag, errmsg = sp.ekfind(step.query)
        if int(error_flag) == 0:
            return StepOutput(op=step.op, value={"ok": True, "nmrows": int(nmrows)})
        return StepOutput(op=step.op, value={"ok": False, "errmsg": str(errmsg)})

    if isinstance(step, StepEkEkgc):
        out = _normalize_ekgc(sp.ekgc(step.selidx, step.row, step.elment))
        return StepOutput(op=step.op, value=out)

    raise TypeError(f"Unsupported step type: {type(step)}")


def run_workflow(req: CaseRequest) -> list[StepOutput]:
    windows: dict[str, Any] = {}
    outputs: list[StepOutput] = []
    for step in req.workflow:
        outputs.append(_run_step(step, windows))
    return outputs
