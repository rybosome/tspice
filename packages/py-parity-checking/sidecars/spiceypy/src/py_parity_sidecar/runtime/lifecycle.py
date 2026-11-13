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


def finalize_case_lifecycle(context: SidecarRuntimeContext) -> None:
    if context.state.frames.ckHandles:
        _reset_best_effort()
        for handle_id, handle in list(context.state.frames.ckHandles.items()):
            try:
                sp.ckupf(handle)
                context.state.frames.ckHandles.pop(handle_id, None)
            except BaseException:
                # Keep the claim for its registered retry before Scratch cleanup.
                pass
    register_default_finalizers(context)
    context.run_finalizers_best_effort()
    _kclear_best_effort()
    _reset_best_effort()
