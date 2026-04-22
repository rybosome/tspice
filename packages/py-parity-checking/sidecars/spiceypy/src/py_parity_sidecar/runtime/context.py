from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from ..models import RuntimePaths
from .path_refs import ensure_scratch_root, remove_scratch_root_best_effort

Finalizer = Callable[[], None]


@dataclass
class CellsWindowsState:
    windows: dict[str, Any] = field(default_factory=dict)


@dataclass
class KernelsState:
    loadedVirtualKernelPaths: list[str] = field(default_factory=list)


@dataclass
class FileIoState:
    openHandles: dict[str, str] = field(default_factory=dict)


@dataclass
class DskState:
    loadedSegments: int = 0


@dataclass
class EkState:
    lastQuery: str | None = None


@dataclass
class EphemerisState:
    requestedTargets: set[int] = field(default_factory=set)


@dataclass
class FramesState:
    requestedFrames: set[str] = field(default_factory=set)


@dataclass
class CaseState:
    cellsWindows: CellsWindowsState = field(default_factory=CellsWindowsState)
    kernels: KernelsState = field(default_factory=KernelsState)
    fileIo: FileIoState = field(default_factory=FileIoState)
    dsk: DskState = field(default_factory=DskState)
    ek: EkState = field(default_factory=EkState)
    ephemeris: EphemerisState = field(default_factory=EphemerisState)
    frames: FramesState = field(default_factory=FramesState)


@dataclass
class SidecarRuntimeContext:
    paths: RuntimePaths
    state: CaseState = field(default_factory=CaseState)
    finalizers: list[tuple[str, Finalizer]] = field(default_factory=list)
    scratchCleanupRegistered: bool = False

    def register_finalizer(self, label: str, finalizer: Finalizer) -> None:
        self.finalizers.append((label, finalizer))

    def run_finalizers_best_effort(self) -> None:
        for _label, finalizer in self.finalizers:
            try:
                finalizer()
            except BaseException:
                # best-effort cleanup only
                pass


def register_default_finalizers(context: SidecarRuntimeContext) -> None:
    if context.scratchCleanupRegistered:
        return

    context.register_finalizer("scratch.cleanup", lambda: remove_scratch_root_best_effort(context.paths))
    context.scratchCleanupRegistered = True


def create_runtime_context(paths: RuntimePaths) -> SidecarRuntimeContext:
    ensure_scratch_root(paths)
    context = SidecarRuntimeContext(paths=paths)
    register_default_finalizers(context)
    return context
