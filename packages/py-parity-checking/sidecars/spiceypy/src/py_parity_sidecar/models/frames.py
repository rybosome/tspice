from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

from .paths import PathRefInput

CkCoverageLevel: TypeAlias = Literal["SEGMENT", "INTERVAL"]
CkCoverageTimeSystem: TypeAlias = Literal["SCLK", "TDB"]


@dataclass(frozen=True)
class StepFramesNamfrm:
    op: Literal["frames.namfrm"]
    name: str


@dataclass(frozen=True)
class StepFramesFrmnam:
    op: Literal["frames.frmnam"]
    code: int


@dataclass(frozen=True)
class StepFramesCidfrm:
    op: Literal["frames.cidfrm"]
    center: int


@dataclass(frozen=True)
class StepFramesCnmfrm:
    op: Literal["frames.cnmfrm"]
    centerName: str


@dataclass(frozen=True)
class StepFramesFrinfo:
    op: Literal["frames.frinfo"]
    frameId: int


@dataclass(frozen=True)
class StepFramesCcifrm:
    op: Literal["frames.ccifrm"]
    frameClass: int
    classId: int


@dataclass(frozen=True)
class StepFramesCkgp:
    op: Literal["frames.ckgp"]
    inst: int
    sclkdp: float
    tol: float
    ref: str


@dataclass(frozen=True)
class StepFramesCkgpav:
    op: Literal["frames.ckgpav"]
    inst: int
    sclkdp: float
    tol: float
    ref: str


@dataclass(frozen=True)
class StepFramesPckcls:
    op: Literal["frames.pckcls"]
    handleId: str


@dataclass(frozen=True)
class StepFramesPckcov:
    op: Literal["frames.pckcov"]
    path: PathRefInput
    classId: int
    coverId: str
    maxIntervals: int
    reset: bool


@dataclass(frozen=True)
class StepFramesPckfrm:
    op: Literal["frames.pckfrm"]
    path: PathRefInput
    idsId: str
    maxCard: int
    reset: bool


@dataclass(frozen=True)
class StepFramesPcklof:
    op: Literal["frames.pcklof"]
    handleId: str
    path: PathRefInput


@dataclass(frozen=True)
class StepFramesPckopn:
    op: Literal["frames.pckopn"]
    handleId: str
    path: PathRefInput
    ifname: str
    ncomch: int


@dataclass(frozen=True)
class StepFramesPckuof:
    op: Literal["frames.pckuof"]
    handleId: str


@dataclass(frozen=True)
class StepFramesPckw02:
    op: Literal["frames.pckw02"]
    handleId: str
    classId: int
    frame: str
    first: float
    last: float
    segid: str
    intlen: float
    n: int
    degree: int
    coefficients: list[float]
    btime: float


@dataclass(frozen=True)
class StepFramesCklpf:
    op: Literal["frames.cklpf"]
    ck: PathRefInput
    handleId: str


@dataclass(frozen=True)
class StepFramesCkupf:
    op: Literal["frames.ckupf"]
    handleId: str


@dataclass(frozen=True)
class StepFramesCkobj:
    op: Literal["frames.ckobj"]
    ck: PathRefInput
    idsId: str
    maxCard: int | None = None
    reset: bool = True


@dataclass(frozen=True)
class StepFramesCkcov:
    op: Literal["frames.ckcov"]
    ck: PathRefInput
    idcode: int
    needav: bool
    level: CkCoverageLevel
    tol: float
    timsys: CkCoverageTimeSystem
    coverId: str
    maxIntervals: int | None = None
    reset: bool = True


@dataclass(frozen=True)
class StepFramesPxform:
    op: Literal["frames.pxform"]
    from_: str
    to: str
    et: float


@dataclass(frozen=True)
class StepFramesSxform:
    op: Literal["frames.sxform"]
    from_: str
    to: str
    et: float
