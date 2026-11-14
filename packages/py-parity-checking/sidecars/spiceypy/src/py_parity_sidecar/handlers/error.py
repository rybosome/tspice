from __future__ import annotations

import ctypes
import spiceypy as sp

from ..models import (
    StepErrorChkin,
    StepErrorChkout,
    StepErrorErrdev,
    StepErrorErrprt,
    StepErrorTrcoff,
    StepErrorErrch,
    StepErrorErrdp,
    StepErrorErrint,
    StepErrorQcktrc,
    StepErrorReturn,
    StepErrorTrcdep,
    StepErrorTrcnam,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext

# SpiceyPy's text decoder strips all trailing whitespace and ignores invalid UTF-8.
# Observe the independent toolkit's actual C output bytes at the requested capacity.
_trace_library = ctypes.CDLL(sp.libspice._name)
_quick_trace = _trace_library.qcktrc_c
_quick_trace.argtypes = [ctypes.c_int, ctypes.POINTER(ctypes.c_char)]
_quick_trace.restype = None
_trace_name = _trace_library.trcnam_c
_trace_name.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_char)]
_trace_name.restype = None


def _trace_text(capacity: int, index: int | None = None) -> str:
    if not -(2**31) <= capacity < 2**31 or (index is not None and not -(2**31) <= index < 2**31):
        raise ValueError("Trace arguments must fit SpiceInt")
    length = min(capacity, 4096 if index is None else 33)
    buf = ctypes.create_string_buffer(max(1, length))
    if index is None:
        _quick_trace(length, buf)
    else:
        _trace_name(index, length, buf)
    sp.check_for_spice_error(None)
    return buf.value.decode("utf-8")


# The pinned SpiceyPy 6.0.3 errprt() mistakenly calls errdev_c. Its other
# policy wrappers strip trailing whitespace and allocate the requested size
# even when only one physical byte is needed for a genuine length diagnostic.
# Bind the two actual N0067 C routines in the independently loaded wheel.
_error_device = _trace_library.errdev_c
_error_print = _trace_library.errprt_c
for _policy_fn in (_error_device, _error_print):
    _policy_fn.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(ctypes.c_char)]
    _policy_fn.restype = None


def _policy_call(fn, operation: str, value: str, capacity: int | None, full: int) -> str | None:
    if operation == "SET":
        data = value.encode("utf-8")
        if b"\0" in data:
            raise ValueError("C input contains NUL")
        buf = ctypes.create_string_buffer(data)
        fn(b"SET", 0, buf)
        sp.check_for_spice_error(None)
        return None
    if operation != "GET" or (capacity is not None and not -(2**31) <= capacity < 2**31):
        raise ValueError("Invalid policy operation or SpiceInt capacity")
    length = full if capacity is None else min(capacity, full)
    buf = ctypes.create_string_buffer(max(1, length))
    fn(b"GET", length, buf)
    sp.check_for_spice_error(None)
    return buf.value.decode("utf-8")


def initialize_policy_oracle() -> None:
    # The two frontends choose different initial policy. Set only the
    # documented tspice starting state in this new, dedicated sidecar process.
    _policy_call(_error_print, "SET", "NONE", None, 41)
    _policy_call(_error_device, "SET", "SCREEN", None, 256)


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
    if isinstance(step, StepErrorErrdev):
        return StepOutput(op=step.op, value=_policy_call(_error_device, step.operation, step.value, step.capacity, 256))

    if isinstance(step, StepErrorErrprt):
        return StepOutput(op=step.op, value=_policy_call(_error_print, step.operation, step.value, step.capacity, 41))

    if isinstance(step, StepErrorTrcoff):
        sp.trcoff()
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepErrorErrch):
        sp.errch(step.marker, step.value)
        sp.check_for_spice_error(None)
        return StepOutput(op=step.op, value=str(sp.getmsg("LONG", 1841)))

    if isinstance(step, StepErrorErrdp):
        sp.errdp(step.marker, step.value)
        sp.check_for_spice_error(None)
        return StepOutput(op=step.op, value=str(sp.getmsg("LONG", 1841)))

    if isinstance(step, StepErrorErrint):
        sp.errint(step.marker, step.value)
        sp.check_for_spice_error(None)
        return StepOutput(op=step.op, value=str(sp.getmsg("LONG", 1841)))

    if isinstance(step, StepErrorQcktrc):
        return StepOutput(op=step.op, value=_trace_text(4096 if step.tracelen is None else step.tracelen))

    if isinstance(step, StepErrorReturn):
        return StepOutput(op=step.op, value=bool(sp.return_c()))

    if isinstance(step, StepErrorTrcdep):
        return StepOutput(op=step.op, value=int(sp.trcdep()))

    if isinstance(step, StepErrorTrcnam):
        return StepOutput(op=step.op, value=_trace_text(33 if step.namlen is None else step.namlen, step.index))

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
