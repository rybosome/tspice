from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .paths import PathRefInput


@dataclass(frozen=True)
class StepFileIoExists:
    op: Literal["file-io.exists"]
    path: PathRefInput


@dataclass(frozen=True)
class StepFileIoGetfat:
    op: Literal["file-io.getfat"]
    path: PathRefInput


@dataclass(frozen=True)
class StepFileIoDafopr:
    op: Literal["file-io.dafopr"]
    path: PathRefInput
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafcls:
    op: Literal["file-io.dafcls"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafbfs:
    op: Literal["file-io.dafbfs"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDaffna:
    op: Literal["file-io.daffna"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDasopr:
    op: Literal["file-io.dasopr"]
    path: PathRefInput
    handleId: str


@dataclass(frozen=True)
class StepFileIoDascls:
    op: Literal["file-io.dascls"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDlaopn:
    op: Literal["file-io.dlaopn"]
    path: PathRefInput
    ftype: str
    ifname: str
    ncomch: int
    handleId: str


@dataclass(frozen=True)
class StepFileIoDlabfs:
    op: Literal["file-io.dlabfs"]
    handleId: str
    descrId: str


@dataclass(frozen=True)
class StepFileIoDlafns:
    op: Literal["file-io.dlafns"]
    handleId: str
    descrId: str


@dataclass(frozen=True)
class StepFileIoDlacls:
    op: Literal["file-io.dlacls"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDskopn:
    op: Literal["file-io.dskopn"]
    path: PathRefInput
    ifname: str
    ncomch: int
    handleId: str


@dataclass(frozen=True)
class StepFileIoDskmi2:
    op: Literal["file-io.dskmi2"]
    nv: int
    vrtces: list[float]
    np: int
    plates: list[int]
    finscl: float
    corscl: float
    worksz: int
    voxpsz: int
    voxlsz: int
    makvtl: bool
    spxisz: int
    spaixId: str | None = None


@dataclass(frozen=True)
class StepFileIoDskw02:
    op: Literal["file-io.dskw02"]
    handleId: str
    center: int
    surfid: int
    dclass: int
    frame: str
    corsys: int
    corpar: list[float]
    mncor1: float
    mxcor1: float
    mncor2: float
    mxcor2: float
    mncor3: float
    mxcor3: float
    first: float
    last: float
    nv: int
    vrtces: list[float]
    np: int
    plates: list[int]
    spaixId: str
