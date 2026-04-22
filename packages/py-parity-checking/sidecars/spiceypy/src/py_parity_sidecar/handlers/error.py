from __future__ import annotations

import spiceypy as sp

from ..models import (
    StepErrorChkin,
    StepErrorChkout,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext

_ALLOWED_GETMSG_SELECTORS = {"SHORT", "LONG", "EXPLAIN"}


def _validate_getmsg_selector(which: str) -> str:
    if which not in _ALLOWED_GETMSG_SELECTORS:
        raise ValueError("error.getmsg.which must be SHORT|LONG|EXPLAIN")
    return which


def _format_sigerr_message() -> str:
    short = str(sp.getmsg("SHORT")).strip()
    long = str(sp.getmsg("LONG")).strip()
    explain = str(sp.getmsg("EXPLAIN")).strip()
    parts = [part for part in [short, long, explain] if part != ""]
    return " | ".join(parts)


def run_error_step(step: WorkflowStep, _context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepErrorFailed):
        return StepOutput(op=step.op, value=bool(sp.failed()))

    if isinstance(step, StepErrorReset):
        sp.reset()
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorGetmsg):
        selector = _validate_getmsg_selector(step.which)
        value = str(sp.getmsg(selector))
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepErrorSetmsg):
        sp.setmsg(step.message)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorSigerr):
        sp.sigerr(step.short)
        if bool(sp.failed()):
            message = _format_sigerr_message()
            raise RuntimeError(message or f"sigerr signaled failure for {step.short!r}")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorChkin):
        sp.chkin(step.name)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorChkout):
        sp.chkout(step.name)
        return StepOutput(op=step.op, value=None)

    return None
