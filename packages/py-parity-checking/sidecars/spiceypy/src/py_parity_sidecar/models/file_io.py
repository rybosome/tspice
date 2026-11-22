from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .paths import PathRefInput


@dataclass(frozen=True)
class StepFileIoDafac:
    op: Literal["file-io.dafac"]
    handleId: str
    lines: list[str]


@dataclass(frozen=True)
class StepFileIoDafdc:
    op: Literal["file-io.dafdc"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafec:
    op: Literal["file-io.dafec"]
    handleId: str
    bufsiz: int
    buffln: int


@dataclass(frozen=True)
class StepFileIoDafrs:
    op: Literal["file-io.dafrs"]
    handleId: str
    summary: list[int]


@dataclass(frozen=True)
class StepFileIoDafps:
    op: Literal["file-io.dafps"]
    nd: int
    ni: int
    dc: list[float]
    ic: list[int]


@dataclass(frozen=True)
class StepFileIoDafus:
    op: Literal["file-io.dafus"]
    summary: list[int]
    nd: int
    ni: int


@dataclass(frozen=True)
class StepFileIoDafgsr:
    op: Literal["file-io.dafgsr"]
    handleId: str
    recno: int
    begin: int
    end: int


@dataclass(frozen=True)
class StepFileIoDafrfr:
    op: Literal["file-io.dafrfr"]
    handleId: str
    ifnlen: int = 61


@dataclass(frozen=True)
class StepFileIoDafrda:
    op: Literal["file-io.dafrda"]
    handleId: str
    begin: int
    end: int


@dataclass(frozen=True)
class StepFileIoDafgda:
    op: Literal["file-io.dafgda"]
    handleId: str
    begin: int
    end: int


@dataclass(frozen=True)
class StepFileIoDafbbs:
    op: Literal["file-io.dafbbs"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafcs:
    op: Literal["file-io.dafcs"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDaffpa:
    op: Literal["file-io.daffpa"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafgh:
    op: Literal["file-io.dafgh"]


@dataclass(frozen=True)
class StepFileIoDafgn:
    op: Literal["file-io.dafgn"]
    handleId: str
    namlen: int = 1001
    captureError: bool = False


@dataclass(frozen=True)
class StepFileIoDafgs:
    op: Literal["file-io.dafgs"]
    handleId: str
    summaryId: str | None = None


@dataclass(frozen=True)
class StepFileIoDafhsf:
    op: Literal["file-io.dafhsf"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDafopw:
    op: Literal["file-io.dafopw"]
    path: PathRefInput
    handleId: str


@dataclass(frozen=True)
class StepFileIoRdtext:
    op: Literal["file-io.rdtext"]
    fileId: str
    text: str
    lineln: int


@dataclass(frozen=True)
class StepFileIoPutcml:
    op: Literal["file-io.putcml"]
    argv: list[str]


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
class StepFileIoDasac:
    op: Literal["file-io.dasac"]
    handleId: str
    lines: list[str]


@dataclass(frozen=True)
class StepFileIoDasdc:
    op: Literal["file-io.dasdc"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDasec:
    op: Literal["file-io.dasec"]
    handleId: str
    bufsiz: int
    buffln: int


@dataclass(frozen=True)
class StepFileIoDasadc:
    op: Literal["file-io.dasadc"]
    handleId: str
    n: int
    bpos: int
    epos: int
    datlen: int
    data: list[int]


@dataclass(frozen=True)
class StepFileIoDasadd:
    op: Literal["file-io.dasadd"]
    handleId: str
    n: int
    data: list[float]


@dataclass(frozen=True)
class StepFileIoDasadi:
    op: Literal["file-io.dasadi"]
    handleId: str
    n: int
    data: list[int]


@dataclass(frozen=True)
class StepFileIoDasrdc:
    op: Literal["file-io.dasrdc"]
    handleId: str
    first: int
    last: int
    bpos: int
    epos: int
    datlen: int
    data: list[int]


@dataclass(frozen=True)
class StepFileIoDasrdd:
    op: Literal["file-io.dasrdd"]
    handleId: str
    first: int
    last: int


@dataclass(frozen=True)
class StepFileIoDasrdi:
    op: Literal["file-io.dasrdi"]
    handleId: str
    first: int
    last: int


@dataclass(frozen=True)
class StepFileIoDasudc:
    op: Literal["file-io.dasudc"]
    handleId: str
    first: int
    last: int
    bpos: int
    epos: int
    datlen: int
    data: list[int]


@dataclass(frozen=True)
class StepFileIoDasudd:
    op: Literal["file-io.dasudd"]
    handleId: str
    first: int
    last: int
    data: list[float]


@dataclass(frozen=True)
class StepFileIoDasudi:
    op: Literal["file-io.dasudi"]
    handleId: str
    first: int
    last: int
    data: list[int]


@dataclass(frozen=True)
class StepFileIoDasonw:
    op: Literal["file-io.dasonw"]
    handleId: str
    path: PathRefInput
    ftype: str
    ifname: str
    ncomr: int


@dataclass(frozen=True)
class StepFileIoDasops:
    op: Literal["file-io.dasops"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDasopw:
    op: Literal["file-io.dasopw"]
    handleId: str
    path: PathRefInput


@dataclass(frozen=True)
class StepFileIoDashfn:
    op: Literal["file-io.dashfn"]
    handleId: str
    namlen: int = 256


@dataclass(frozen=True)
class StepFileIoDashfs:
    op: Literal["file-io.dashfs"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDaslla:
    op: Literal["file-io.daslla"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDasllc:
    op: Literal["file-io.dasllc"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDasrfr:
    op: Literal["file-io.dasrfr"]
    handleId: str
    idwlen: int = 9
    ifnlen: int = 61


@dataclass(frozen=True)
class StepFileIoDaswbr:
    op: Literal["file-io.daswbr"]
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
class StepFileIoDlabbs:
    op: Literal["file-io.dlabbs"]
    handleId: str
    descrId: str


@dataclass(frozen=True)
class StepFileIoDlabns:
    op: Literal["file-io.dlabns"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDlaens:
    op: Literal["file-io.dlaens"]
    handleId: str


@dataclass(frozen=True)
class StepFileIoDlafps:
    op: Literal["file-io.dlafps"]
    handleId: str
    descrId: str


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
    corscl: int
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
