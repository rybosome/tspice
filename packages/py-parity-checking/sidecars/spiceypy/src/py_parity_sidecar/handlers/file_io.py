from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import (
    StepFileIoDafbfs,
    StepFileIoDafcls,
    StepFileIoDaffna,
    StepFileIoDafopr,
    StepFileIoDascls,
    StepFileIoDasopr,
    StepFileIoDlabfs,
    StepFileIoDlacls,
    StepFileIoDlafns,
    StepFileIoDlaopn,
    StepFileIoDskmi2,
    StepFileIoDskopn,
    StepFileIoDskw02,
    StepFileIoExists,
    StepFileIoGetfat,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref

SPAIX_HEAD_LIMIT = 8


@dataclass
class HandleState:
    handle: int
    kind: str
    closeWith: str
    isOpen: bool


@dataclass
class FileIoState:
    handles: dict[str, HandleState]
    descriptors: dict[str, Any]
    spatialIndexes: dict[str, tuple[np.ndarray, np.ndarray]]


def _resolve_file_io_path(context: SidecarRuntimeContext, path_value: str) -> str:
    return resolve_path_ref(context.paths, path_value)


def _prepare_output_path(path_value: str) -> None:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.is_file():
        path.unlink()


def _register_handle(
    state: FileIoState,
    handle_id: str,
    handle: int,
    *,
    kind: str,
    close_with: str,
) -> None:
    existing = state.handles.get(handle_id)
    if existing is not None and existing.isOpen:
        raise ValueError(f"File-io handle already exists and is open: {handle_id}")

    state.handles[handle_id] = HandleState(
        handle=int(handle),
        kind=kind,
        closeWith=close_with,
        isOpen=True,
    )


def _require_handle(
    state: FileIoState,
    handle_id: str,
    *,
    expected_kind: str | None = None,
    require_open: bool = False,
) -> HandleState:
    handle_state = state.handles.get(handle_id)
    if handle_state is None:
        raise ValueError(f"File-io handle does not exist: {handle_id}")

    if expected_kind is not None and handle_state.kind != expected_kind:
        raise ValueError(
            f"File-io handle {handle_id} has kind {handle_state.kind}, expected {expected_kind}",
        )

    if require_open and not handle_state.isOpen:
        raise ValueError(f"File-io handle is invalid or closed: {handle_id}")

    return handle_state


def _require_descriptor(state: FileIoState, descr_id: str) -> Any:
    descr = state.descriptors.get(descr_id)
    if descr is None:
        raise ValueError(f"File-io descriptor does not exist: {descr_id}")
    return descr


def _require_spatial_index(state: FileIoState, spaix_id: str) -> tuple[np.ndarray, np.ndarray]:
    index = state.spatialIndexes.get(spaix_id)
    if index is None:
        raise ValueError(f"File-io spatial index does not exist: {spaix_id}")
    return index


def _normalize_dla_result(value: Any) -> tuple[bool, Any | None]:
    if isinstance(value, tuple) and len(value) == 2 and isinstance(value[1], (bool, int)):
        descr, found_raw = value
        found = bool(found_raw)
        if not found:
            return False, None
        return True, descr

    return True, value


def _reshape_vrtces(flat_vrtces: list[float], *, nv: int, label: str) -> np.ndarray:
    if nv <= 0:
        raise ValueError(f"{label}.nv must be > 0")

    expected_len = nv * 3
    if len(flat_vrtces) != expected_len:
        raise ValueError(f"{label}.vrtces length must be {expected_len}")

    return np.asarray(flat_vrtces, dtype=np.float64).reshape((nv, 3))


def _reshape_plates(flat_plates: list[int], *, np_count: int, label: str) -> np.ndarray:
    if np_count <= 0:
        raise ValueError(f"{label}.np must be > 0")

    expected_len = np_count * 3
    if len(flat_plates) != expected_len:
        raise ValueError(f"{label}.plates length must be {expected_len}")

    return np.asarray(flat_plates, dtype=np.int32).reshape((np_count, 3))


def _summarize_spatial_index(spaixd: np.ndarray, spaixi: np.ndarray) -> dict[str, Any]:
    return {
        "spaixdLength": int(spaixd.size),
        "spaixiLength": int(spaixi.size),
        "spaixdHead": spaixd[:SPAIX_HEAD_LIMIT].astype(float).tolist(),
        "spaixiHead": spaixi[:SPAIX_HEAD_LIMIT].astype(int).tolist(),
    }


def run_file_io_step(step: WorkflowStep, state: FileIoState, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepFileIoExists):
        return StepOutput(op=step.op, value=bool(sp.exists(_resolve_file_io_path(context, step.path))))

    if isinstance(step, StepFileIoGetfat):
        arch, ftype = sp.getfat(_resolve_file_io_path(context, step.path))
        return StepOutput(op=step.op, value={"arch": str(arch), "type": str(ftype)})

    if isinstance(step, StepFileIoDafopr):
        handle = int(sp.dafopr(_resolve_file_io_path(context, step.path)))
        _register_handle(state, step.handleId, handle, kind="DAF", close_with="dafcls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDafcls):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAF",
            require_open=True,
        )
        sp.dafcls(handle_state.handle)
        handle_state.isOpen = False
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDafbfs):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAF",
            require_open=True,
        )
        sp.dafbfs(handle_state.handle)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDaffna):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAF",
            require_open=True,
        )
        sp.dafcs(handle_state.handle)
        found = bool(sp.daffna())
        return StepOutput(op=step.op, value=found)

    if isinstance(step, StepFileIoDasopr):
        handle = int(sp.dasopr(_resolve_file_io_path(context, step.path)))
        _register_handle(state, step.handleId, handle, kind="DAS", close_with="dascls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDascls):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAS",
            require_open=True,
        )
        sp.dascls(handle_state.handle)
        handle_state.isOpen = False
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDlaopn):
        _prepare_output_path(_resolve_file_io_path(context, step.path))
        handle = int(sp.dlaopn(_resolve_file_io_path(context, step.path), step.ftype, step.ifname, step.ncomch))
        _register_handle(state, step.handleId, handle, kind="DAS", close_with="dascls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDlabfs):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAS",
            require_open=True,
        )
        try:
            found, descr = _normalize_dla_result(sp.dlabfs(handle_state.handle))
        except NotFoundError:
            found = False
            descr = None

        if not found or descr is None:
            state.descriptors.pop(step.descrId, None)
            return StepOutput(op=step.op, value={"found": False})

        state.descriptors[step.descrId] = descr
        return StepOutput(op=step.op, value={"found": True})

    if isinstance(step, StepFileIoDlafns):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAS",
            require_open=True,
        )
        descr = _require_descriptor(state, step.descrId)
        try:
            found, next_descr = _normalize_dla_result(sp.dlafns(handle_state.handle, descr))
        except NotFoundError:
            found = False
            next_descr = None

        if not found or next_descr is None:
            state.descriptors.pop(step.descrId, None)
            return StepOutput(op=step.op, value={"found": False})

        state.descriptors[step.descrId] = next_descr
        return StepOutput(op=step.op, value={"found": True})

    if isinstance(step, StepFileIoDlacls):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAS",
            require_open=True,
        )
        # SpiceyPy does not expose dlacls; CSPICE defines it as an alias of dascls.
        sp.dascls(handle_state.handle)
        handle_state.isOpen = False
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDskopn):
        _prepare_output_path(_resolve_file_io_path(context, step.path))
        handle = int(sp.dskopn(_resolve_file_io_path(context, step.path), step.ifname, step.ncomch))
        _register_handle(state, step.handleId, handle, kind="DAS", close_with="dascls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDskmi2):
        vrtces = _reshape_vrtces(step.vrtces, nv=step.nv, label=step.op)
        plates = _reshape_plates(step.plates, np_count=step.np, label=step.op)
        spaixd, spaixi = sp.dskmi2(
            vrtces,
            plates,
            step.finscl,
            int(step.corscl),
            step.worksz,
            step.voxpsz,
            step.voxlsz,
            step.makvtl,
            step.spxisz,
        )

        spaixd_arr = np.asarray(spaixd, dtype=np.float64)
        spaixi_arr = np.asarray(spaixi, dtype=np.int32)
        if step.spaixId is not None:
            state.spatialIndexes[step.spaixId] = (spaixd_arr.copy(), spaixi_arr.copy())

        return StepOutput(op=step.op, value=_summarize_spatial_index(spaixd_arr, spaixi_arr))

    if isinstance(step, StepFileIoDskw02):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind="DAS",
            require_open=True,
        )
        spaixd, spaixi = _require_spatial_index(state, step.spaixId)
        vrtces = _reshape_vrtces(step.vrtces, nv=step.nv, label=step.op)
        plates = _reshape_plates(step.plates, np_count=step.np, label=step.op)
        corpar = np.asarray(step.corpar, dtype=np.float64)

        sp.dskw02(
            handle_state.handle,
            step.center,
            step.surfid,
            step.dclass,
            step.frame,
            step.corsys,
            corpar,
            step.mncor1,
            step.mxcor1,
            step.mncor2,
            step.mxcor2,
            step.mncor3,
            step.mxcor3,
            step.first,
            step.last,
            vrtces,
            plates,
            spaixd,
            spaixi,
        )
        return StepOutput(op=step.op, value=None)

    return None
