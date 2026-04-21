from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepEkEkfind:
    op: Literal["ek.ekfind"]
    query: str


@dataclass(frozen=True)
class StepEkEkgc:
    op: Literal["ek.ekgc"]
    selidx: int
    row: int
    elment: int
