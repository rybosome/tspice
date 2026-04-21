from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError
from spiceypy.utils.support_types import SPICEDOUBLE_CELL, SPICEINT_CELL

from ..models import (
    StepFramesCcifrm,
    StepFramesCidfrm,
    StepFramesCkcov,
    StepFramesCkgp,
    StepFramesCkgpav,
    StepFramesCklpf,
    StepFramesCkobj,
    StepFramesCkupf,
    StepFramesCnmfrm,
    StepFramesFrinfo,
    StepFramesFrmnam,
    StepFramesNamfrm,
    StepFramesPxform,
    StepFramesSxform,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref


def _to_matrix3(value: Any) -> list[list[float]]:
    rows_raw = value.tolist() if hasattr(value, "tolist") else value
    if not isinstance(rows_raw, list) or len(rows_raw) != 3:
        raise ValueError(f"Expected 3x3 matrix, got: {rows_raw!r}")

    out: list[list[float]] = []
    for row in rows_raw:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError(f"Expected 3x3 matrix row, got: {row!r}")
        out.append([float(row[0]), float(row[1]), float(row[2])])
    return out


def _to_matrix6(value: Any) -> list[list[float]]:
    rows_raw = value.tolist() if hasattr(value, "tolist") else value
    if not isinstance(rows_raw, list) or len(rows_raw) != 6:
        raise ValueError(f"Expected 6x6 matrix, got: {rows_raw!r}")

    out: list[list[float]] = []
    for row in rows_raw:
        if not isinstance(row, list) or len(row) != 6:
            raise ValueError(f"Expected 6x6 matrix row, got: {row!r}")
        out.append([float(v) for v in row])
    return out


def _to_vec3(value: Any) -> list[float]:
    values_raw = value.tolist() if hasattr(value, "tolist") else value
    if not isinstance(values_raw, list) or len(values_raw) != 3:
        raise ValueError(f"Expected length-3 vector, got: {values_raw!r}")
    return [float(values_raw[0]), float(values_raw[1]), float(values_raw[2])]


def _normalize_namfrm(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple) and len(value) == 2 and isinstance(value[1], (bool, int)):
        code_raw, found_raw = value
        if not bool(found_raw):
            return {"found": False}
        code = int(code_raw)
        if code == 0:
            return {"found": False}
        return {"found": True, "code": code}

    code = int(value)
    if code == 0:
        return {"found": False}
    return {"found": True, "code": code}


def _normalize_frmnam(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple) and len(value) == 2 and isinstance(value[1], (bool, int)):
        name_raw, found_raw = value
        if not bool(found_raw):
            return {"found": False}
        name = str(name_raw)
        if name.strip() == "":
            return {"found": False}
        return {"found": True, "name": name}

    name = str(value)
    if name.strip() == "":
        return {"found": False}
    return {"found": True, "name": name}


def _normalize_frcode_frname(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 3 and isinstance(value[2], (bool, int)):
            frcode_raw, frname_raw, found_raw = value
            if not bool(found_raw):
                return {"found": False}
            return {
                "found": True,
                "frcode": int(frcode_raw),
                "frname": str(frname_raw),
            }
        if len(value) == 2:
            frcode_raw, frname_raw = value
            return {
                "found": True,
                "frcode": int(frcode_raw),
                "frname": str(frname_raw),
            }
    raise ValueError(f"Unexpected frame lookup shape: {value!r}")


def _normalize_frinfo(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4 and isinstance(value[3], (bool, int)):
            center_raw, frame_class_raw, class_id_raw, found_raw = value
            if not bool(found_raw):
                return {"found": False}
            return {
                "found": True,
                "center": int(center_raw),
                "frameClass": int(frame_class_raw),
                "classId": int(class_id_raw),
            }
        if len(value) == 3:
            center_raw, frame_class_raw, class_id_raw = value
            return {
                "found": True,
                "center": int(center_raw),
                "frameClass": int(frame_class_raw),
                "classId": int(class_id_raw),
            }
    raise ValueError(f"Unexpected frinfo shape: {value!r}")


def _normalize_ccifrm(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4 and isinstance(value[3], (bool, int)):
            frcode_raw, frname_raw, center_raw, found_raw = value
            if not bool(found_raw):
                return {"found": False}
            return {
                "found": True,
                "frcode": int(frcode_raw),
                "frname": str(frname_raw),
                "center": int(center_raw),
            }
        if len(value) == 3:
            frcode_raw, frname_raw, center_raw = value
            return {
                "found": True,
                "frcode": int(frcode_raw),
                "frname": str(frname_raw),
                "center": int(center_raw),
            }
    raise ValueError(f"Unexpected ccifrm shape: {value!r}")


def _normalize_ckgp(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 3 and isinstance(value[2], (bool, int)):
            cmat_raw, clkout_raw, found_raw = value
            if not bool(found_raw):
                return {"found": False}
            return {
                "found": True,
                "cmat": _to_matrix3(cmat_raw),
                "clkout": float(clkout_raw),
            }
        if len(value) == 2:
            cmat_raw, clkout_raw = value
            return {
                "found": True,
                "cmat": _to_matrix3(cmat_raw),
                "clkout": float(clkout_raw),
            }
    raise ValueError(f"Unexpected ckgp shape: {value!r}")


def _normalize_ckgpav(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4 and isinstance(value[3], (bool, int)):
            cmat_raw, av_raw, clkout_raw, found_raw = value
            if not bool(found_raw):
                return {"found": False}
            return {
                "found": True,
                "cmat": _to_matrix3(cmat_raw),
                "av": _to_vec3(av_raw),
                "clkout": float(clkout_raw),
            }
        if len(value) == 3:
            cmat_raw, av_raw, clkout_raw = value
            return {
                "found": True,
                "cmat": _to_matrix3(cmat_raw),
                "av": _to_vec3(av_raw),
                "clkout": float(clkout_raw),
            }
    raise ValueError(f"Unexpected ckgpav shape: {value!r}")


def _set_ck_handle(context: SidecarRuntimeContext, handle_id: str, handle: int) -> None:
    if handle_id in context.state.frames.ckHandles:
        raise ValueError(f"CK handle already exists: {handle_id}")
    context.state.frames.ckHandles[handle_id] = int(handle)


def _require_ck_handle(context: SidecarRuntimeContext, handle_id: str) -> int:
    handle = context.state.frames.ckHandles.get(handle_id)
    if handle is None:
        raise ValueError(f"CK handle does not exist: {handle_id}")
    return handle


def _remove_ck_handle(context: SidecarRuntimeContext, handle_id: str) -> None:
    context.state.frames.ckHandles.pop(handle_id, None)


def _get_or_create_window(context: SidecarRuntimeContext, window_id: str, *, max_intervals: int) -> Any:
    existing = context.state.cellsWindows.windows.get(window_id)
    if existing is not None:
        return existing

    if max_intervals <= 0:
        raise ValueError("maxIntervals must be > 0")

    window = SPICEDOUBLE_CELL(max_intervals * 2)
    context.state.cellsWindows.windows[window_id] = window
    context.register_finalizer(
        f"cellsWindows.release:{window_id}",
        lambda: context.state.cellsWindows.windows.pop(window_id, None),
    )
    return window


def _window_to_intervals(window: Any) -> list[dict[str, float]]:
    n_intervals = int(sp.wncard(window))
    intervals: list[dict[str, float]] = []
    for index in range(n_intervals):
        left, right = sp.wnfetd(window, index)
        intervals.append({"left": float(left), "right": float(right)})
    return intervals


def run_frames_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepFramesNamfrm):
        out = _normalize_namfrm(sp.namfrm(step.name))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepFramesFrmnam):
        out = _normalize_frmnam(sp.frmnam(step.code))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepFramesCidfrm):
        try:
            out = _normalize_frcode_frname(sp.cidfrm(step.center))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesCnmfrm):
        try:
            out = _normalize_frcode_frname(sp.cnmfrm(step.centerName))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesFrinfo):
        try:
            out = _normalize_frinfo(sp.frinfo(step.frameId))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesCcifrm):
        try:
            out = _normalize_ccifrm(sp.ccifrm(step.frameClass, step.classId))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesCkgp):
        try:
            out = _normalize_ckgp(sp.ckgp(step.inst, step.sclkdp, step.tol, step.ref))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesCkgpav):
        try:
            out = _normalize_ckgpav(sp.ckgpav(step.inst, step.sclkdp, step.tol, step.ref))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepFramesCklpf):
        ck_path = resolve_path_ref(context.paths, step.ck)
        handle = sp.cklpf(ck_path)
        _set_ck_handle(context, step.handleId, int(handle))
        return StepOutput(op=step.op, value={"opened": True})

    if isinstance(step, StepFramesCkupf):
        handle = _require_ck_handle(context, step.handleId)
        sp.ckupf(handle)
        _remove_ck_handle(context, step.handleId)
        return StepOutput(op=step.op, value={"closed": True})

    if isinstance(step, StepFramesCkobj):
        ck_path = resolve_path_ref(context.paths, step.ck)
        ids = SPICEINT_CELL(step.maxCard or 32)
        sp.scard(0, ids)
        sp.ckobj(ck_path, ids)
        return StepOutput(op=step.op, value={"ids": [int(v) for v in list(ids)]})

    if isinstance(step, StepFramesCkcov):
        ck_path = resolve_path_ref(context.paths, step.ck)
        cover = _get_or_create_window(
            context,
            step.coverId,
            max_intervals=step.maxIntervals or 128,
        )
        sp.scard(0, cover)
        sp.ckcov(ck_path, step.idcode, step.needav, step.level, step.tol, step.timsys, cover)
        return StepOutput(op=step.op, value={"intervals": _window_to_intervals(cover)})

    if isinstance(step, StepFramesPxform):
        out = sp.pxform(step.from_, step.to, step.et)
        return StepOutput(op=step.op, value=_to_matrix3(out))

    if isinstance(step, StepFramesSxform):
        out = sp.sxform(step.from_, step.to, step.et)
        return StepOutput(op=step.op, value=_to_matrix6(out))

    return None
