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
    if context.state.ephemeris.spkHandles:
        _reset_best_effort()
        for handle_id,handle in list(context.state.ephemeris.spkHandles.items()):
            try:
                sp.spkcls(handle)
                context.state.ephemeris.spkHandles.pop(handle_id,None)
            except BaseException:
                # Preserve the claim for its registered retry before Scratch.
                pass
    register_default_finalizers(context)
    context.run_finalizers_best_effort()
    _kclear_best_effort()
    _reset_best_effort()
