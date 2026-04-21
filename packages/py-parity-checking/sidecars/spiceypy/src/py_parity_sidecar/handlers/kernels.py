from __future__ import annotations

from pathlib import Path
from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError
from spiceypy.utils.support_types import SPICEINT_CELL

from ..models import (
    PathRefInput,
    StepKernelsFurnsh,
    StepKernelsKclear,
    StepKernelsKdata,
    StepKernelsKinfo,
    StepKernelsKplfrm,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepKernelsUnload,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref, to_path_ref


def _basename(path_value: str) -> str:
    if path_value.strip() == "":
        return ""
    return Path(path_value).name


def _to_virtual_kernel_path(path_ref_input: PathRefInput) -> str:
    if isinstance(path_ref_input, str) and Path(path_ref_input).is_absolute():
        return f"py-parity/{Path(path_ref_input).name}"

    path_ref = to_path_ref(path_ref_input)
    if path_ref.kind == "fixture":
        return f"py-parity/{path_ref.rel}"
    return f"py-parity/scratch/{path_ref.rel}"


def _normalize_kinfo(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4 and isinstance(value[3], (bool, int)):
            filtyp, source, _handle, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }
        if len(value) == 3:
            filtyp, source, _handle = value
            return {
                "found": True,
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }
    raise ValueError(f"Unexpected kinfo return shape: {value!r}")


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


def _normalize_kplfrm(value: Any) -> dict[str, Any]:
    return {"ids": sorted(int(item) for item in value)}


def run_kernels_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepKernelsFurnsh):
        resolved_file = resolve_path_ref(context.paths, step.file)
        sp.furnsh(resolved_file)
        context.state.kernels.loadedVirtualKernelPaths.append(_to_virtual_kernel_path(step.file))
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelsKclear):
        sp.kclear()
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelsKinfo):
        try:
            out = _normalize_kinfo(sp.kinfo(resolve_path_ref(context.paths, step.path)))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelsKplfrm):
        out = _normalize_kplfrm(sp.kplfrm(step.frmcls, SPICEINT_CELL(1024)))
        return StepOutput(op=step.op, value=out)

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

    if isinstance(step, StepKernelsUnload):
        sp.unload(resolve_path_ref(context.paths, step.path))
        return StepOutput(op=step.op, value=None)

    return None
