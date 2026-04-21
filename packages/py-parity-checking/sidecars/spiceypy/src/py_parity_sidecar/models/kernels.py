from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepKernelsFurnsh:
    op: Literal["kernels.furnsh"]
    file: str


@dataclass(frozen=True)
class StepKernelsKtotal:
    op: Literal["kernels.ktotal"]
    kind: str


@dataclass(frozen=True)
class StepKernelsKdata:
    op: Literal["kernels.kdata"]
    which: int
    kind: str


@dataclass(frozen=True)
class StepKernelsKxtrct:
    op: Literal["kernels.kxtrct"]
    keywd: str
    terms: list[str]
    string: str
