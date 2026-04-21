from __future__ import annotations

from pathlib import Path
from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import StepKernelsFurnsh, StepKernelsKdata, StepKernelsKtotal, StepKernelsKxtrct, StepOutput, WorkflowStep


def _basename(path_value: str) -> str:
    if path_value.strip() == "":
        return ""
    return Path(path_value).name


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


def run_kernels_step(step: WorkflowStep) -> StepOutput | None:
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

    return None
