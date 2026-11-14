from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from .. import das_data_oracle
from ..das_file_oracle import file_record, file_name
from ..models import (
    StepFileIoDafbfs,
    StepFileIoDafcls,
    StepFileIoDaffna,
    StepFileIoDafopr,
    StepFileIoDasadc,
    StepFileIoDasadd,
    StepFileIoDasadi,
    StepFileIoDasrdc,
    StepFileIoDasrdd,
    StepFileIoDasrdi,
    StepFileIoDasudc,
    StepFileIoDasudd,
    StepFileIoDasudi,
    StepFileIoDasonw,
    StepFileIoDasops,
    StepFileIoDasopw,
    StepFileIoDashfn,
    StepFileIoDashfs,
    StepFileIoDaslla,
    StepFileIoDasllc,
    StepFileIoDasrfr,
    StepFileIoDaswbr,
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
from ..runtime import FileIoHandleState, FileIoState, SidecarRuntimeContext, resolve_path_ref

def _resolve_file_io_path(context: SidecarRuntimeContext, path_value: str) -> str:
    return resolve_path_ref(context.paths, path_value)


def _prepare_output_path(path_value: str) -> None:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)


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

    state.handles[handle_id] = FileIoHandleState(
        handle=int(handle),
        kind=kind,
        closeWith=close_with,
        isOpen=True,
    )


def _require_handle(
    state: FileIoState,
    handle_id: str,
    *,
    expected_kind: str | tuple[str, ...] | None = None,
    require_open: bool = False,
) -> FileIoHandleState:
    handle_state = state.handles.get(handle_id)
    if handle_state is None:
        raise ValueError(f"File-io handle does not exist: {handle_id}")

    if expected_kind is not None:
        expected_kinds = (expected_kind,) if isinstance(expected_kind, str) else expected_kind
        if len(expected_kinds) == 1:
            expected_kind_label = expected_kinds[0]
        else:
            expected_kind_label = " or ".join(expected_kinds)

        if handle_state.kind not in expected_kinds:
            raise ValueError(
                f"File-io handle {handle_id} has kind {handle_state.kind}, expected {expected_kind_label}",
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


def _descriptor_fields(descr: Any) -> dict[str, int]:
    return {key: int(getattr(descr, key)) for key in (
        "bwdptr", "fwdptr", "ibase", "isize", "dbase", "dsize", "cbase", "csize"
    )}


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


def run_file_io_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    state = context.state.fileIo

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

    if isinstance(step, StepFileIoDasadc):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasadc(h, step.n, step.bpos, step.epos, step.datlen, step.data))

    if isinstance(step, StepFileIoDasadd):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasadd(h, step.n, step.data))

    if isinstance(step, StepFileIoDasadi):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasadi(h, step.n, step.data))

    if isinstance(step, StepFileIoDasrdc):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasrdc(h, step.first, step.last, step.bpos, step.epos, step.datlen, step.data))

    if isinstance(step, StepFileIoDasrdd):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasrdd(h, step.first, step.last))

    if isinstance(step, StepFileIoDasrdi):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasrdi(h, step.first, step.last))

    if isinstance(step, StepFileIoDasudc):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasudc(h, step.first, step.last, step.bpos, step.epos, step.datlen, step.data))

    if isinstance(step, StepFileIoDasudd):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasudd(h, step.first, step.last, step.data))

    if isinstance(step, StepFileIoDasudi):
        h = _require_handle(state, step.handleId, expected_kind=("DAS", "DLA"), require_open=True).handle
        return StepOutput(op=step.op, value=das_data_oracle.dasudi(h, step.first, step.last, step.data))

    if isinstance(step, (StepFileIoDasonw, StepFileIoDasopw, StepFileIoDasops)):
        existing = state.handles.get(step.handleId)
        if existing is not None and existing.isOpen:
            raise ValueError(f"File-io handle already open: {step.handleId}")
        if isinstance(step, StepFileIoDasops):
            handle = sp.dasops()
        else:
            if isinstance(step.path, str) or step.path.kind != "scratch":
                raise ValueError("DAS writer workflows require a scratch path")
            path = _resolve_file_io_path(context, step.path)
            if isinstance(step, StepFileIoDasonw):
                # Registered tests create small files. Keep oversized record counts
                # out of the independent writer before allocation or disk I/O.
                if not -(2**31) <= step.ncomr <= 500:
                    raise ValueError("DAS oracle comment record count outside fixture range")
                _prepare_output_path(path)
                handle = sp.dasonw(path,step.ftype,step.ifname,step.ncomr)
            else:
                handle = sp.dasopw(path)
        _register_handle(state,step.handleId,handle,kind="DAS",close_with="dascls")
        return StepOutput(op=step.op,value=None)

    if isinstance(step,(StepFileIoDashfn,StepFileIoDashfs,StepFileIoDaslla,
                        StepFileIoDasrfr,StepFileIoDaswbr,StepFileIoDasllc)):
        entry = _require_handle(state,step.handleId,expected_kind=("DAS","DLA"),require_open=True)
        h = entry.handle
        if isinstance(step,StepFileIoDashfn):
            value = file_name(h,step.namlen)
            full = file_name(h,256)
            if full == "":
                name = ""
            else:
                p = Path(full).resolve()
                scratch = Path(context.paths.scratchRoot).resolve()
                if p.is_relative_to(scratch):
                    name = "scratch/" + p.relative_to(scratch).as_posix()
                else:
                    name = p.relative_to(Path(context.paths.fixturesRoot).resolve()).as_posix()
            return StepOutput(op=step.op,value=dict(name=name,prefixMatches=value==full[:step.namlen-1]))
        if isinstance(step,StepFileIoDashfs):
            rr,rc,cr,cc,free,la,record,word = sp.dashfs(h)
            return StepOutput(op=step.op,value=dict(nresvr=rr,nresvc=rc,ncomr=cr,ncomc=cc,
                              free=free,lastla=la.tolist(),lastrc=record.tolist(),lastwd=word.tolist()))
        if isinstance(step,StepFileIoDaslla):
            c,d,i=sp.daslla(h)
            return StepOutput(op=step.op,value=dict(lastc=c,lastd=d,lasti=i))
        if isinstance(step,StepFileIoDasrfr):
            return StepOutput(op=step.op,value=file_record(h,step.idwlen,step.ifnlen))
        if isinstance(step,StepFileIoDaswbr):
            sp.daswbr(h)
        else:
            sp.dasllc(h)
            entry.isOpen=False
        return StepOutput(op=step.op,value=None)

    if isinstance(step, StepFileIoDasopr):
        handle = int(sp.dasopr(_resolve_file_io_path(context, step.path)))
        _register_handle(state, step.handleId, handle, kind="DAS", close_with="dascls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDascls):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind=("DAS", "DLA"),
            require_open=True,
        )
        sp.dascls(handle_state.handle)
        handle_state.isOpen = False
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDlaopn):
        _prepare_output_path(_resolve_file_io_path(context, step.path))
        handle = int(sp.dlaopn(_resolve_file_io_path(context, step.path), step.ftype, step.ifname, step.ncomch))
        _register_handle(state, step.handleId, handle, kind="DLA", close_with="dascls")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepFileIoDlabfs):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind=("DAS", "DLA"),
            require_open=True,
        )
        try:
            found, descr = _normalize_dla_result(sp.dlabfs(handle_state.handle))
        except NotFoundError:
            # The Found decorator runs before SpiceyPy's outer error check.
            # Preserve actual CSPICE failures rather than treating them as misses.
            sp.check_for_spice_error(None)
            found = False
            descr = None

        if not found or descr is None:
            state.descriptors.pop(step.descrId, None)
            return StepOutput(op=step.op, value={"found": False})

        state.descriptors[step.descrId] = descr
        return StepOutput(op=step.op, value={"found": True, "descr": _descriptor_fields(descr)})

    if isinstance(step, StepFileIoDlafns):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind=("DAS", "DLA"),
            require_open=True,
        )
        descr = _require_descriptor(state, step.descrId)
        try:
            found, next_descr = _normalize_dla_result(sp.dlafns(handle_state.handle, descr))
        except NotFoundError:
            # The Found decorator runs before SpiceyPy's outer error check.
            # Preserve actual CSPICE failures rather than treating them as misses.
            sp.check_for_spice_error(None)
            found = False
            next_descr = None

        if not found or next_descr is None:
            state.descriptors.pop(step.descrId, None)
            return StepOutput(op=step.op, value={"found": False})

        state.descriptors[step.descrId] = next_descr
        return StepOutput(op=step.op, value={"found": True, "descr": _descriptor_fields(next_descr)})

    if isinstance(step, StepFileIoDlacls):
        handle_state = _require_handle(
            state,
            step.handleId,
            expected_kind=("DAS", "DLA"),
            require_open=True,
        )
        # tspice exposes dlacls as a DAS-close alias; CSPICE has no separate dlacls_c entrypoint.
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
            step.corscl,
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

        return StepOutput(op=step.op, value={"spaixd": spaixd_arr.astype(float).tolist(), "spaixi": spaixi_arr.astype(int).tolist()})

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
