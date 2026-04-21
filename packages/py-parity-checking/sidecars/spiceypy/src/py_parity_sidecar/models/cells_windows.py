from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


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
