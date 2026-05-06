from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

KernelPoolVarType = Literal["C", "N"]


@dataclass(frozen=True)
class StepKernelPoolGdpool:
    op: Literal["kernel-pool.gdpool"]
    name: str
    start: int
    room: int


@dataclass(frozen=True)
class StepKernelPoolGipool:
    op: Literal["kernel-pool.gipool"]
    name: str
    start: int
    room: int


@dataclass(frozen=True)
class StepKernelPoolGcpool:
    op: Literal["kernel-pool.gcpool"]
    name: str
    start: int
    room: int


@dataclass(frozen=True)
class StepKernelPoolGnpool:
    op: Literal["kernel-pool.gnpool"]
    template: str
    start: int
    room: int


@dataclass(frozen=True)
class StepKernelPoolDtpool:
    op: Literal["kernel-pool.dtpool"]
    name: str


@dataclass(frozen=True)
class StepKernelPoolPdpool:
    op: Literal["kernel-pool.pdpool"]
    name: str
    values: list[float]


@dataclass(frozen=True)
class StepKernelPoolPipool:
    op: Literal["kernel-pool.pipool"]
    name: str
    values: list[int]


@dataclass(frozen=True)
class StepKernelPoolPcpool:
    op: Literal["kernel-pool.pcpool"]
    name: str
    values: list[str]


@dataclass(frozen=True)
class StepKernelPoolSwpool:
    op: Literal["kernel-pool.swpool"]
    agent: str
    names: list[str]


@dataclass(frozen=True)
class StepKernelPoolCvpool:
    op: Literal["kernel-pool.cvpool"]
    agent: str


@dataclass(frozen=True)
class StepKernelPoolExpool:
    op: Literal["kernel-pool.expool"]
    name: str
