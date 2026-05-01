from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CellsWindowsTargetKind = Literal["int", "double", "char", "window"]


@dataclass(frozen=True)
class StepCellsWindowsCard:
    op: Literal["cells-windows.card"]
    targetKind: CellsWindowsTargetKind
    targetId: str


@dataclass(frozen=True)
class StepCellsWindowsInsrtc:
    op: Literal["cells-windows.insrtc"]
    cellId: str
    item: str
    maxCardinality: int | None = None
    length: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsInsrtd:
    op: Literal["cells-windows.insrtd"]
    cellId: str
    item: float
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsInsrti:
    op: Literal["cells-windows.insrti"]
    cellId: str
    item: int
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsScard:
    op: Literal["cells-windows.scard"]
    card: int
    targetKind: CellsWindowsTargetKind
    targetId: str


@dataclass(frozen=True)
class StepCellsWindowsSize:
    op: Literal["cells-windows.size"]
    targetKind: CellsWindowsTargetKind
    targetId: str


@dataclass(frozen=True)
class StepCellsWindowsSsize:
    op: Literal["cells-windows.ssize"]
    size: int
    targetKind: CellsWindowsTargetKind
    targetId: str


@dataclass(frozen=True)
class StepCellsWindowsValid:
    op: Literal["cells-windows.valid"]
    size: int
    n: int
    targetKind: CellsWindowsTargetKind
    targetId: str


@dataclass(frozen=True)
class StepCellsWindowsWncard:
    op: Literal["cells-windows.wncard"]
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWninsd:
    op: Literal["cells-windows.wninsd"]
    windowId: str
    left: float
    right: float
    maxIntervals: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsWnfetd:
    op: Literal["cells-windows.wnfetd"]
    windowId: str
    index: int


@dataclass(frozen=True)
class StepCellsWindowsWnvald:
    op: Literal["cells-windows.wnvald"]
    size: int
    n: int
    windowId: str
