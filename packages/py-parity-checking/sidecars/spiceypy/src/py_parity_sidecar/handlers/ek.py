from __future__ import annotations

import ctypes
from pathlib import Path

import spiceypy as sp
from spiceypy.utils import support_types as stypes
from spiceypy.utils.libspicehelper import libspice

from .. import ek_metadata_oracle as metadata
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
    StepEkEkccnt,
    StepEkEkcii,
    StepEkEklef,
    StepEkEknelt,
    StepEkEkpsel,
    StepEkEkssum,
    StepEkEkuef,
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
        if handle_id in context.state.ek.loads:
            sp.ekuef(0 if handle_id in context.state.ek.expiredLoads else handle)
            context.state.ek.loads.discard(handle_id)
        else:
            sp.ekcls(handle)
    except BaseException:
        # Keep the claim so cleanup can retry the actual close.
        return

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


def _normalize_ekgc(value: object) -> dict[str, object]:
    if not isinstance(value, tuple) or len(value) != 3:
        raise ValueError(f"Unexpected ekgc return shape: {value!r}")
    text, is_null, found = value
    if found not in (False, True) or is_null not in (0, 1):
        raise ValueError(f"Unexpected ekgc flags: {value!r}")
    if not found:
        return {"found": False}
    if is_null:
        return {"found": True, "isNull": True}
    if not isinstance(text, str):
        raise ValueError(f"Unexpected ekgc text: {text!r}")
    return {"found": True, "isNull": False, "value": text}


def _normalize_numeric_get(value: object, *, fn_name: str) -> dict[str, object]:
    if not isinstance(value, tuple) or len(value) != 3:
        raise ValueError(f"Unexpected {fn_name} return shape: {value!r}")
    number, is_null, found = value
    if found not in (False, True) or is_null not in (0, 1):
        raise ValueError(f"Unexpected {fn_name} flags: {value!r}")
    if not found:
        return {"found": False}
    if is_null:
        return {"found": True, "isNull": True}
    if isinstance(number, bool) or not isinstance(number, (int, float)):
        raise ValueError(f"Unexpected {fn_name} value: {number!r}")
    return {"found": True, "isNull": False, "value": number}


def _cnamelen(values: list[str]) -> int:
    if len(values) == 0:
        return 1
    return max(len(value) for value in values) + 1


def _declen(values: list[str]) -> int:
    if len(values) == 0:
        return 1
    return max(len(value) for value in values) + 1


def _resolve_ek_path(context: SidecarRuntimeContext, raw_path: PathRef | str) -> str:
    if not isinstance(raw_path, str):
        return resolve_path_ref(context.paths, raw_path)
    if Path(raw_path).is_absolute():
        return str(Path(raw_path).resolve())

    return resolve_path_ref(
        context.paths,
        PathRef(kind="scratch", rel=raw_path),
    )


def run_ek_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    metadata_steps = (StepEkEkccnt,StepEkEkcii,StepEkEklef,StepEkEknelt,StepEkEkpsel,StepEkEkssum,StepEkEkuef)
    if isinstance(step,metadata_steps) and context.state.ek.activeMetadataWrite is not None:
        raise ValueError("Finish the active EK fast write before inspecting metadata")
    if isinstance(step,StepEkEkccnt):
        return StepOutput(op=step.op,value=sp.ekccnt(step.table))

    if isinstance(step,StepEkEkcii):
        return StepOutput(op=step.op,value=metadata.ekcii(step.table,step.cindex,step.collen))

    if isinstance(step,StepEkEklef):
        if step.handleId in context.state.ek.handles: raise ValueError("Duplicate EK workflow handle")
        h=sp.eklef(_resolve_ek_path(context,step.path))
        _register_handle(context,step.handleId,h)
        context.state.ek.loads.add(step.handleId)
        context.state.ek.lastSuccessfulFindNmrows=None
        return StepOutput(op=step.op,value={"handleId":step.handleId})

    if isinstance(step,StepEkEknelt):
        if step.row>=0 and step.selidx>=0 and context.state.ek.lastSuccessfulFindNmrows is None and sp.ekntab()>0:
            raise ValueError("Run ekfind before reading result rows")
        return StepOutput(op=step.op,value=metadata.eknelt(step.selidx,step.row))

    if isinstance(step,StepEkEkpsel):
        return StepOutput(op=step.op,value=metadata.ekpsel(step.query))

    if isinstance(step,StepEkEkssum):
        if step.handleId in context.state.ek.expiredLoads:
            raise ValueError("EK query load is no longer active")
        return StepOutput(op=step.op,value=metadata.ekssum(_require_handle(context,step.handleId),step.segno))

    if isinstance(step,StepEkEkuef):
        h=_require_handle(context,step.handleId)
        if step.handleId not in context.state.ek.loads: raise ValueError("Expected EK query load")
        expired = step.handleId in context.state.ek.expiredLoads
        sp.ekuef(0 if expired else h)
        for k in list(context.state.ek.loads):
            if context.state.ek.handles.get(k)==h and ((k in context.state.ek.expiredLoads) == expired):
                context.state.ek.handles.pop(k,None)
                context.state.ek.loads.discard(k)
                context.state.ek.expiredLoads.discard(k)
        context.state.ek.lastSuccessfulFindNmrows=None
        return StepOutput(op=step.op,value=None)

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
        if step.handleId in context.state.ek.loads:
            raise ValueError("EK query registration must be released with ekuef")
        _close_handle(context, step.handleId)
        active=context.state.ek.activeMetadataWrite
        if active is not None and active[0]==step.handleId:
            context.state.ek.activeMetadataWrite=None
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
        nmrows, error_flag, errmsg = sp.ekfind(step.query, 2048)
        if int(error_flag) == 0:
            nmrows_int = int(nmrows)
            context.state.ek.lastSuccessfulFindNmrows = nmrows_int
            return StepOutput(op=step.op, value={"ok": True, "nmrows": nmrows_int})
        context.state.ek.lastSuccessfulFindNmrows = None
        return StepOutput(op=step.op, value={"ok": False, "errmsg": str(errmsg)})

    # Disable only the found-result decorator so the outer SpiceyPy error
    # checker still raises actual INVALIDINDEX/INVALIDTYPE. A legitimate
    # missing element remains a returned found=False tuple, without stale status.
    if isinstance(step, StepEkEkgc):
        with sp.no_found_check():
            out = _normalize_ekgc(sp.ekgc(step.selidx, step.row, step.elment, 2048))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepEkEkgd):
        with sp.no_found_check():
            out = _normalize_numeric_get(sp.ekgd(step.selidx, step.row, step.elment), fn_name="ekgd")
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepEkEkgi):
        with sp.no_found_check():
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
        context.state.ek.activeMetadataWrite = (step.handleId,int(segno))
        context.state.ek.lastSuccessfulFindNmrows = None
        _register_segment(
            context,
            step.segmentId,
            EkSegmentState(
                handleId=step.handleId,
                segno=int(segno),
                rcptrs=[int(value) for value in rcptrs],
            ),
        )
        return StepOutput(op=step.op, value={"segmentId": step.segmentId, "segno": int(segno), "rcptrs": [int(value) for value in rcptrs]})

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
        sizes = list(step.entszs)
        values = list(step.cvals)
        summary = sp.ekssum(handle, segment.segno)
        for name, descriptor in zip(summary.cnames, summary.cdescrs):
            if name.strip().casefold() != step.column.strip().casefold():
                continue
            # N0067's C character writer allocates flags by total value count
            # then copies nrows flags. Ignored NULL placeholders keep that
            # storage safe, including all-NULL columns; literal readback verifies
            # the actual NULLs. Its own implementation also calls ekssum_c.
            if descriptor.size == -1 and descriptor.nullok:
                packed: list[str] = []
                offset = 0
                for i, size in enumerate(sizes):
                    if step.nlflgs[i] and size == 0:
                        sizes[i] = 1
                        packed.append("")
                    else:
                        packed.extend(values[offset:offset + size])
                        offset += size
                values = packed
            break
        # SpiceyPy6.0.3 computes its backing width separately with len(str),
        # which differs from UTF-8 byte width and cannot encode empty inputs.
        # Call that same actual CSPICE entrypoint through SpiceyPy's ctypes
        # library with an explicitly packed buffer, then its real error checker.
        encoded = [value.encode("utf-8") for value in values]
        vallen = max(3, max((len(value) + 1 for value in encoded), default=3))
        buffer = ctypes.create_string_buffer(
            b"".join(value.ljust(vallen, b"\0") for value in encoded),
            max(1, len(encoded) * vallen),
        )
        libspice.ekaclc_c(handle, segment.segno, stypes.string_to_char_p(step.column),
            vallen, buffer, stypes.to_int_vector(sizes),
            stypes.to_int_vector(step.nlflgs), stypes.to_int_vector(segment.rcptrs),
            stypes.to_int_vector([0] * nrows))
        sp.check_for_spice_error(sp.ekaclc)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepEkEkffld):
        segment = _require_segment(context, step.segmentId)
        handle = _require_handle(context, segment.handleId)
        sp.ekffld(handle, segment.segno, segment.rcptrs)
        if context.state.ek.activeMetadataWrite == (segment.handleId,segment.segno):
            context.state.ek.activeMetadataWrite = None
        return StepOutput(op=step.op, value=None)

    return None
