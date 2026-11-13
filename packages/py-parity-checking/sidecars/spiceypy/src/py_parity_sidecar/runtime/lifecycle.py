from __future__ import annotations

import spiceypy as sp

from .context import SidecarRuntimeContext, register_default_finalizers


def before_case_lifecycle() -> None:
    sp.kclear()
    sp.reset()


def _kclear_best_effort() -> None:
    try:
        sp.kclear()
    except BaseException:
        pass


def _reset_best_effort() -> None:
    try:
        sp.reset()
    except BaseException:
        pass


def _close_ek_handles_best_effort(context: SidecarRuntimeContext) -> None:
    # The response/error has already been captured. Pending toolkit status must
    # not skip actual closes, and scratch files must remain until after close.
    _reset_best_effort()
    for handle_id, handle in list(context.state.ek.handles.items()):
        try:
            sp.ekcls(handle)
        except BaseException:
            continue
        context.state.ek.handles.pop(handle_id, None)
        stale = [key for key, segment in context.state.ek.segments.items()
                 if segment.handleId == handle_id]
        for key in stale:
            context.state.ek.segments.pop(key, None)


def finalize_case_lifecycle(context: SidecarRuntimeContext) -> None:
    _close_ek_handles_best_effort(context)
    register_default_finalizers(context)
    context.run_finalizers_best_effort()
    _kclear_best_effort()
    _reset_best_effort()
