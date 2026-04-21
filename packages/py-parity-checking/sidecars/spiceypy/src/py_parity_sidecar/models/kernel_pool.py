from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepKernelPoolGcpool:
    op: Literal["kernel-pool.gcpool"]
    name: str
    start: int
    room: int
