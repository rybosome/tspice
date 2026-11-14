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
class StepCellsWindowsAppndc:
    op: Literal["cells-windows.appndc"]
    cellId: str
    item: str
    maxCardinality: int | None = None
    length: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsAppndd:
    op: Literal["cells-windows.appndd"]
    cellId: str
    item: float
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsAppndi:
    op: Literal["cells-windows.appndi"]
    cellId: str
    item: int
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsCopy:
    op: Literal["cells-windows.copy"]
    kind: Literal["char", "int", "double"]
    sourceId: str
    resultId: str
    maxCardinality: int | None = None
    length: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsElemc:
    op: Literal["cells-windows.elemc"]
    cellId: str
    item: str
    maxCardinality: int | None = None
    length: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsElemd:
    op: Literal["cells-windows.elemd"]
    cellId: str
    item: float
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsElemi:
    op: Literal["cells-windows.elemi"]
    cellId: str
    item: int
    maxCardinality: int | None = None


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
class StepCellsWindowsWncomd:
    op: Literal["cells-windows.wncomd"]
    left: float
    right: float
    windowId: str
    resultId: str
    maxIntervals: int


@dataclass(frozen=True)
class StepCellsWindowsWncond:
    op: Literal["cells-windows.wncond"]
    left: float
    right: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWndifd:
    op: Literal["cells-windows.wndifd"]
    aId: str
    bId: str
    resultId: str
    maxIntervals: int


@dataclass(frozen=True)
class StepCellsWindowsWnelmd:
    op: Literal["cells-windows.wnelmd"]
    point: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnexpd:
    op: Literal["cells-windows.wnexpd"]
    left: float
    right: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnextd:
    op: Literal["cells-windows.wnextd"]
    side: str
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnfild:
    op: Literal["cells-windows.wnfild"]
    small: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnfltd:
    op: Literal["cells-windows.wnfltd"]
    small: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnincd:
    op: Literal["cells-windows.wnincd"]
    left: float
    right: float
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnintd:
    op: Literal["cells-windows.wnintd"]
    aId: str
    bId: str
    resultId: str
    maxIntervals: int


@dataclass(frozen=True)
class StepCellsWindowsWnreld:
    op: Literal["cells-windows.wnreld"]
    aId: str
    relation: str
    bId: str


@dataclass(frozen=True)
class StepCellsWindowsWnsumd:
    op: Literal["cells-windows.wnsumd"]
    windowId: str


@dataclass(frozen=True)
class StepCellsWindowsWnunid:
    op: Literal["cells-windows.wnunid"]
    aId: str
    bId: str
    resultId: str
    maxIntervals: int


@dataclass(frozen=True)
class StepCellsWindowsWnvald:
    op: Literal["cells-windows.wnvald"]
    size: int
    n: int
    windowId: str
