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
    short = str(sp.getmsg("SHORT", 1841)).strip()
    long = str(sp.getmsg("LONG", 1841)).strip()
    explain = str(sp.getmsg("EXPLAIN", 1841)).strip()
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
        value = str(sp.getmsg(selector, 1841))
        return StepOutput(op=step.op, value=value)

    if isinstance(step, StepErrorSetmsg):
        sp.setmsg(step.message)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorSigerr):
        sp.sigerr(step.short)
        if step.capture:
            if not bool(sp.failed()):
                raise RuntimeError("sp.sigerr did not signal an error")
            try:
                value = {"short": str(sp.getmsg("SHORT", 1841)),
                         "long": str(sp.getmsg("LONG", 1841)),
                         "trace": str(sp.qcktrc(1841))}
            finally:
                # tspice's shared shim captures and resets before throwing.
                # Keep that documented wrapper policy explicit on the oracle.
                sp.reset()
            value["failed"] = bool(sp.failed())
            return StepOutput(op=step.op, value=value)
        if bool(sp.failed()):
            message = _format_sigerr_message()
            raise RuntimeError(message or f"sigerr signaled failure for {step.short!r}")
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorChkin):
        sp.chkin(step.name)
        state = _context.state
        state.errorTraceStack.append(step.name)
        if not state.errorTraceCleanupRegistered:
            state.errorTraceCleanupRegistered = True
            def unwind_trace() -> None:
                while state.errorTraceStack:
                    name = state.errorTraceStack.pop()
                    try:
                        sp.chkout(name)
                    except Exception:
                        pass
            _context.register_finalizer("error.unwindTrace", unwind_trace)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorChkout):
        sp.chkout(step.name)
        if _context.state.errorTraceStack:
            _context.state.errorTraceStack.pop()
        return StepOutput(op=step.op, value=None)

    return None
