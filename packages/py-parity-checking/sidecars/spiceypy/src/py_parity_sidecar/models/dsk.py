from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .paths import PathRefInput

Vec3 = tuple[float, float, float]
IndexTriple = tuple[int, int, int]


@dataclass(frozen=True)
class StepDskDskobj:
    op: Literal["dsk.dskobj"]
    path: PathRefInput


@dataclass(frozen=True)
class StepDskDsksrf:
    op: Literal["dsk.dsksrf"]
    path: PathRefInput
    bodyid: int


@dataclass(frozen=True)
class StepDskDskopn:
    op: Literal["dsk.dskopn"]
    handleId: str
    path: PathRefInput
    ifname: str
    ncomch: int


@dataclass(frozen=True)
class StepDskDskmi2:
    op: Literal["dsk.dskmi2"]
    spatialIndexId: str
    vrtces: list[Vec3]
    plates: list[IndexTriple]
    finscl: float
    corscl: int
    worksz: int
    voxpsz: int
    voxlsz: int
    makvtl: bool
    spxisz: int


@dataclass(frozen=True)
class StepDskDskw02:
    op: Literal["dsk.dskw02"]
    handleId: str
    spatialIndexId: str
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
    vrtces: list[Vec3]
    plates: list[IndexTriple]


@dataclass(frozen=True)
class StepDskDasopr:
    op: Literal["dsk.dasopr"]
    handleId: str
    path: PathRefInput


@dataclass(frozen=True)
class StepDskDascls:
    op: Literal["dsk.dascls"]
    handleId: str


@dataclass(frozen=True)
class StepDskDlabfs:
    op: Literal["dsk.dlabfs"]
    handleId: str
    dladscId: str


@dataclass(frozen=True)
class StepDskDskgd:
    op: Literal["dsk.dskgd"]
    handleId: str
    dladscId: str


@dataclass(frozen=True)
class StepDskDskb02:
    op: Literal["dsk.dskb02"]
    handleId: str
    dladscId: str
