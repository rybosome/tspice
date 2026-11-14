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
class StepFramesCkopn:
    op: Literal["frames.ckopn"]
    handleId: str
    path: PathRefInput
    ifname: str
    ncomch: int


@dataclass(frozen=True)
class StepFramesCkcls:
    op: Literal["frames.ckcls"]
    handleId: str


@dataclass(frozen=True)
class StepFramesCkw01:
    op: Literal["frames.ckw01"]
    handleId: str
    beg: float
    end: float
    inst: int
    ref: str
    av: bool
    segid: str
    ticks: list[float]
    quats: list[float]
    avvs: list[float]


@dataclass(frozen=True)
class StepFramesCkw02:
    op: Literal["frames.ckw02"]
    handleId: str
    beg: float
    end: float
    inst: int
    ref: str
    segid: str
    starts: list[float]
    stops: list[float]
    quats: list[float]
    avvs: list[float]
    rates: list[float]


@dataclass(frozen=True)
class StepFramesCkw03:
    op: Literal["frames.ckw03"]
    handleId: str
    beg: float
    end: float
    inst: int
    ref: str
    av: bool
    segid: str
    ticks: list[float]
    quats: list[float]
    avvs: list[float]
    intervalStarts: list[float]


@dataclass(frozen=True)
class StepFramesCkw05:
    op: Literal["frames.ckw05"]
    handleId: str
    subtype: int
    degree: int
    beg: float
    end: float
    inst: int
    ref: str
    av: bool
    segid: str
    ticks: list[float]
    packets: list[float]
    rate: float
    intervalStarts: list[float]


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
