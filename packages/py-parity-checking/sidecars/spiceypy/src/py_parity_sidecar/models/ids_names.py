from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepIdsNamesBodn2c:
    op: Literal["ids-names.bodn2c"]
    name: str
