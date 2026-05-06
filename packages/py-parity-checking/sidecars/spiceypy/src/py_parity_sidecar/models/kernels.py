from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .paths import PathRefInput


@dataclass(frozen=True)
class StepKernelsFurnsh:
    op: Literal["kernels.furnsh"]
    file: PathRefInput


@dataclass(frozen=True)
class StepKernelsKclear:
    op: Literal["kernels.kclear"]


@dataclass(frozen=True)
class StepKernelsKinfo:
    op: Literal["kernels.kinfo"]
    path: str


@dataclass(frozen=True)
class StepKernelsKplfrm:
    op: Literal["kernels.kplfrm"]
    frmcls: int


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


@dataclass(frozen=True)
class StepKernelsUnload:
    op: Literal["kernels.unload"]
    path: str
