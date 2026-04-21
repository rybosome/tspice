from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepEkEkopn:
    op: Literal["ek.ekopn"]
    path: str
    ifname: str
    ncomch: int
    handleId: str


@dataclass(frozen=True)
class StepEkEkopr:
    op: Literal["ek.ekopr"]
    path: str
    handleId: str


@dataclass(frozen=True)
class StepEkEkopw:
    op: Literal["ek.ekopw"]
    path: str
    handleId: str


@dataclass(frozen=True)
class StepEkEkcls:
    op: Literal["ek.ekcls"]
    handleId: str


@dataclass(frozen=True)
class StepEkEkntab:
    op: Literal["ek.ekntab"]


@dataclass(frozen=True)
class StepEkEktnam:
    op: Literal["ek.ektnam"]
    n: int


@dataclass(frozen=True)
class StepEkEknseg:
    op: Literal["ek.eknseg"]
    handleId: str


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


@dataclass(frozen=True)
class StepEkEkgd:
    op: Literal["ek.ekgd"]
    selidx: int
    row: int
    elment: int


@dataclass(frozen=True)
class StepEkEkgi:
    op: Literal["ek.ekgi"]
    selidx: int
    row: int
    elment: int


@dataclass(frozen=True)
class StepEkEkifld:
    op: Literal["ek.ekifld"]
    handleId: str
    tabnam: str
    nrows: int
    cnames: list[str]
    decls: list[str]
    segmentId: str


@dataclass(frozen=True)
class StepEkEkacli:
    op: Literal["ek.ekacli"]
    segmentId: str
    column: str
    ivals: list[int]
    entszs: list[int]
    nlflgs: list[bool]


@dataclass(frozen=True)
class StepEkEkacld:
    op: Literal["ek.ekacld"]
    segmentId: str
    column: str
    dvals: list[float]
    entszs: list[int]
    nlflgs: list[bool]


@dataclass(frozen=True)
class StepEkEkaclc:
    op: Literal["ek.ekaclc"]
    segmentId: str
    column: str
    cvals: list[str]
    entszs: list[int]
    nlflgs: list[bool]


@dataclass(frozen=True)
class StepEkEkffld:
    op: Literal["ek.ekffld"]
    segmentId: str
