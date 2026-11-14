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


def _close_dsk_handles_best_effort(context: SidecarRuntimeContext) -> None:
    for entry in context.state.dsk.handles.values():
        if not entry.get("isOpen", False):
            continue
        try:
            sp.dascls(int(entry["handle"]))
            entry["isOpen"] = False
        except BaseException:
            # Retain the marker for the registered finalizer's retry.
            pass


def finalize_case_lifecycle(context: SidecarRuntimeContext) -> None:
    if context.state.ephemeris.spkHandles:
        _reset_best_effort()
        for handle_id, handle in list(context.state.ephemeris.spkHandles.items()):
            try:
                if handle in context.state.ephemeris.spk14_degrees:
                    sp.spk14e(handle)
                    del context.state.ephemeris.spk14_degrees[handle]
                sp.spkcls(handle)
                context.state.ephemeris.spkHandles.pop(handle_id, None)
            except BaseException:
                # Preserve the claim for its registered retry before Scratch.
                pass

    _close_file_io_handles_best_effort(context)
    _close_dsk_handles_best_effort(context)
    _close_ek_handles_best_effort(context)

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
