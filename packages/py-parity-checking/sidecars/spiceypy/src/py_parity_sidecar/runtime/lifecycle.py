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


def _close_file_io_handles_best_effort(context: SidecarRuntimeContext) -> None:
    # The response/error has already been captured. Clear any pending toolkit
    # failure so it cannot prevent the actual close calls from running.
    _reset_best_effort()
    for entry in context.state.fileIo.handles.values():
        if not entry.isOpen:
            continue
        try:
            if entry.closeWith == "dafcls":
                sp.dafcls(entry.handle)
            else:
                sp.dascls(entry.handle)
            entry.isOpen = False
        except BaseException:
            # Keep the open marker if native close fails; process teardown is
            # the final backstop, and other handles still need a close attempt.
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

    _close_file_io_handles_best_effort(context)
    register_default_finalizers(context)
    context.run_finalizers_best_effort()
    _kclear_best_effort()
    _reset_best_effort()
