from __future__ import annotations

import os
from typing import Any

import spiceypy as sp

from ..models import (
    StepDskDascls,
    StepDskDasopr,
    StepDskDlabfs,
    StepDskDskb02,
    StepDskDskgd,
    StepDskDskmi2,
    StepDskDskobj,
    StepDskDskopn,
    StepDskDsksrf,
    StepDskDskw02,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref, to_path_ref


def _ensure_cleanup_finalizer(context: SidecarRuntimeContext) -> None:
    if context.state.dsk.cleanupRegistered:
        return

    def _close_open_handles_best_effort() -> None:
        for tracked in context.state.dsk.handles.values():
            if not bool(tracked.get("isOpen", False)):
                continue
            try:
                sp.dascls(int(tracked["handle"]))
            except BaseException:
                # best-effort cleanup only
                pass

    context.register_finalizer("dsk.close-open-handles", _close_open_handles_best_effort)
    context.state.dsk.cleanupRegistered = True


def _resolve_dsk_path(context: SidecarRuntimeContext, path_ref_input: Any) -> str:
    return resolve_path_ref(context.paths, path_ref_input)


def _set_handle(context: SidecarRuntimeContext, handle_id: str, handle: int, *, is_open: bool) -> None:
    context.state.dsk.handles[handle_id] = {
        "handle": int(handle),
        "isOpen": is_open,
    }


def _require_handle(context: SidecarRuntimeContext, handle_id: str) -> dict[str, Any]:
    tracked = context.state.dsk.handles.get(handle_id)
    if tracked is None:
        raise ValueError(f"DSK handle does not exist: {handle_id}")
    return tracked


def _require_dladsc(context: SidecarRuntimeContext, dladsc_id: str) -> Any:
    descr = context.state.dsk.dladsc.get(dladsc_id)
    if descr is None:
        raise ValueError(f"DLA descriptor does not exist: {dladsc_id}")
    return descr


def _require_spatial_index(context: SidecarRuntimeContext, spatial_index_id: str) -> dict[str, Any]:
    index = context.state.dsk.spatialIndexes.get(spatial_index_id)
    if index is None:
        raise ValueError(f"DSK spatial index does not exist: {spatial_index_id}")
    return index


def _coerce_dlabfs(value: Any) -> tuple[bool, Any | None]:
    if isinstance(value, tuple):
        if len(value) == 2 and isinstance(value[1], (bool, int)):
            descr, found_raw = value
            found = bool(found_raw)
            return found, descr if found else None
        raise ValueError(f"Unexpected dlabfs return shape: {value!r}")
    return True, value


def _normalize_dskgd(value: Any) -> dict[str, Any]:
    return {
        "surfce": int(value.surfce),
        "center": int(value.center),
        "dclass": int(value.dclass),
        "dtype": int(value.dtype),
        "frmcde": int(value.frmcde),
        "corsys": int(value.corsys),
        "corpar": [float(v) for v in list(value.corpar)],
        "co1min": float(value.co1min),
        "co1max": float(value.co1max),
        "co2min": float(value.co2min),
        "co2max": float(value.co2max),
        "co3min": float(value.co3min),
        "co3max": float(value.co3max),
        "start": float(value.start),
        "stop": float(value.stop),
    }


def _normalize_vtxbds(value: Any) -> list[list[float]]:
    rows_raw = value.tolist() if hasattr(value, "tolist") else value
    rows = [list(row) for row in rows_raw]

    if len(rows) == 2 and all(len(row) == 3 for row in rows):
        # SpiceyPy currently materializes `vtxbds[3][2]` as a `2x3` matrix.
        # Preserve raw row-major memory order to recover canonical axis pairs:
        # [[xmin, xmax], [ymin, ymax], [zmin, zmax]].
        flat = [
            float(rows[0][0]),
            float(rows[0][1]),
            float(rows[0][2]),
            float(rows[1][0]),
            float(rows[1][1]),
            float(rows[1][2]),
        ]
        return [
            [flat[0], flat[1]],
            [flat[2], flat[3]],
            [flat[4], flat[5]],
        ]

    if len(rows) == 3 and all(len(row) == 2 for row in rows):
        return [[float(row[0]), float(row[1])] for row in rows]

    raise ValueError(f"Unexpected dskb02 vtxbds shape: {value!r}")


def _normalize_dskb02(value: Any) -> dict[str, Any]:
    if not isinstance(value, tuple) or len(value) != 11:
        raise ValueError(f"Unexpected dskb02 return shape: {value!r}")

    (
        nv,
        np,
        nvxtot,
        vtxbds,
        voxsiz,
        voxori,
        vgrext,
        cgscal,
        vtxnpl,
        voxnpt,
        voxnpl,
    ) = value

    voxori_list = [float(v) for v in list(voxori)]
    if len(voxori_list) != 3:
        raise ValueError(f"Unexpected dskb02 voxori shape: {voxori!r}")

    vgrext_list = [int(v) for v in list(vgrext)]
    if len(vgrext_list) != 3:
        raise ValueError(f"Unexpected dskb02 vgrext shape: {vgrext!r}")

    return {
        "nv": int(nv),
        "np": int(np),
        "nvxtot": int(nvxtot),
        "vtxbds": _normalize_vtxbds(vtxbds),
        "voxsiz": float(voxsiz),
        "voxori": [voxori_list[0], voxori_list[1], voxori_list[2]],
        "vgrext": [vgrext_list[0], vgrext_list[1], vgrext_list[2]],
        "cgscal": int(cgscal),
        "vtxnpl": int(vtxnpl),
        "voxnpt": int(voxnpt),
        "voxnpl": int(voxnpl),
    }


def run_dsk_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    _ensure_cleanup_finalizer(context)

    if isinstance(step, StepDskDskobj):
        path = _resolve_dsk_path(context, step.path)
        out = [int(v) for v in sp.dskobj(path)]
        return StepOutput(op=step.op, value={"bodyIds": out})

    if isinstance(step, StepDskDsksrf):
        path = _resolve_dsk_path(context, step.path)
        out = [int(v) for v in sp.dsksrf(path, step.bodyid)]
        return StepOutput(op=step.op, value={"surfaceIds": out})

    if isinstance(step, StepDskDskopn):
        path = _resolve_dsk_path(context, step.path)
        path_ref = to_path_ref(step.path)
        if path_ref.kind == "scratch" and os.path.exists(path):
            os.remove(path)
        handle = int(sp.dskopn(path, step.ifname, step.ncomch))
        _set_handle(context, step.handleId, handle, is_open=True)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepDskDskmi2):
        spaixd, spaixi = sp.dskmi2(
            step.vrtces,
            step.plates,
            step.finscl,
            step.corscl,
            step.worksz,
            step.voxpsz,
            step.voxlsz,
            step.makvtl,
            step.spxisz,
        )
        context.state.dsk.spatialIndexes[step.spatialIndexId] = {
            "spaixd": spaixd,
            "spaixi": spaixi,
        }
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepDskDskw02):
        tracked = _require_handle(context, step.handleId)
        spatial_index = _require_spatial_index(context, step.spatialIndexId)
        sp.dskw02(
            int(tracked["handle"]),
            step.center,
            step.surfid,
            step.dclass,
            step.frame,
            step.corsys,
            step.corpar,
            step.mncor1,
            step.mxcor1,
            step.mncor2,
            step.mxcor2,
            step.mncor3,
            step.mxcor3,
            step.first,
            step.last,
            step.vrtces,
            step.plates,
            spatial_index["spaixd"],
            spatial_index["spaixi"],
        )
        context.state.dsk.loadedSegments += 1
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepDskDasopr):
        path = _resolve_dsk_path(context, step.path)
        handle = int(sp.dasopr(path))
        _set_handle(context, step.handleId, handle, is_open=True)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepDskDascls):
        tracked = _require_handle(context, step.handleId)
        sp.dascls(int(tracked["handle"]))
        _set_handle(context, step.handleId, int(tracked["handle"]), is_open=False)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepDskDlabfs):
        tracked = _require_handle(context, step.handleId)
        found, descr = _coerce_dlabfs(sp.dlabfs(int(tracked["handle"])))
        if not found:
            context.state.dsk.dladsc.pop(step.dladscId, None)
            return StepOutput(op=step.op, value={"found": False})

        context.state.dsk.dladsc[step.dladscId] = descr
        return StepOutput(op=step.op, value={"found": True})

    if isinstance(step, StepDskDskgd):
        tracked = _require_handle(context, step.handleId)
        descr = _require_dladsc(context, step.dladscId)
        out = _normalize_dskgd(sp.dskgd(int(tracked["handle"]), descr))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepDskDskb02):
        tracked = _require_handle(context, step.handleId)
        descr = _require_dladsc(context, step.dladscId)
        out = _normalize_dskb02(sp.dskb02(int(tracked["handle"]), descr))
        return StepOutput(op=step.op, value=out)

    return None
