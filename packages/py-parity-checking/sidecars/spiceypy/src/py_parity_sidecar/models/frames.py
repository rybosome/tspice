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
class StepFramesCkfrot:
    op: Literal["frames.ckfrot"]
    inst: int
    et: float


@dataclass(frozen=True)
class StepFramesCkfxfm:
    op: Literal["frames.ckfxfm"]
    inst: int
    et: float


@dataclass(frozen=True)
class StepFramesCkgr02:
    op: Literal["frames.ckgr02"]
    handleId: str
    summaryId: str
    recno: int


@dataclass(frozen=True)
class StepFramesCkgr03:
    op: Literal["frames.ckgr03"]
    handleId: str
    summaryId: str
    recno: int


@dataclass(frozen=True)
class StepFramesCkmeta:
    op: Literal["frames.ckmeta"]
    ckid: int
    meta: str


@dataclass(frozen=True)
class StepFramesCknr02:
    op: Literal["frames.cknr02"]
    handleId: str
    summaryId: str


@dataclass(frozen=True)
class StepFramesCknr03:
    op: Literal["frames.cknr03"]
    handleId: str
    summaryId: str


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
class StepFramesBltfrm:
    op: Literal["frames.bltfrm"]
    frameClass: int
    idsId: str
    maxCard: int


@dataclass(frozen=True)
class StepFramesPxfrm2:
    op: Literal["frames.pxfrm2"]
    from_: str
    to: str
    etfrom: float
    etto: float


@dataclass(frozen=True)
class StepFramesTipbod:
    op: Literal["frames.tipbod"]
    ref: str
    body: int
    et: float


@dataclass(frozen=True)
class StepFramesTisbod:
    op: Literal["frames.tisbod"]
    ref: str
    body: int
    et: float


@dataclass(frozen=True)
class StepFramesTkfram:
    op: Literal["frames.tkfram"]
    typeId: int


@dataclass(frozen=True)
class StepFramesXfmsta:
    op: Literal["frames.xfmsta"]
    state: list[float]
    from_: str
    to: str
    body: str


@dataclass(frozen=True)
class StepFramesPxform:
    op: Literal["frames.pxform"]
    from_: str
    to: str
    et: float


@dataclass(frozen=True)
class StepFramesFrame:
    op: Literal["frames.frame"]
    x: tuple[float, float, float]


@dataclass(frozen=True)
class StepFramesTwovec:
    op: Literal["frames.twovec"]
    axdef: tuple[float, float, float]
    indexa: int
    plndef: tuple[float, float, float]
    indexp: int


@dataclass(frozen=True)
class StepFramesTwovxf:
    op: Literal["frames.twovxf"]
    axdef: list[float]
    indexa: int
    plndef: list[float]
    indexp: int


@dataclass(frozen=True)
class StepFramesEul2xf:
    op: Literal["frames.eul2xf"]
    eulang: list[float]
    axisa: int
    axisb: int
    axisc: int


@dataclass(frozen=True)
class StepFramesXf2eul:
    op: Literal["frames.xf2eul"]
    xform: list[list[float]]
    axisa: int
    axisb: int
    axisc: int


@dataclass(frozen=True)
class StepFramesXf2rav:
    op: Literal["frames.xf2rav"]
    xform: list[list[float]]


@dataclass(frozen=True)
class StepFramesRav2xf:
    op: Literal["frames.rav2xf"]
    rot: list[list[float]]
    av: tuple[float, float, float]


@dataclass(frozen=True)
class StepFramesInvstm:
    op: Literal["frames.invstm"]
    mat: list[list[float]]


@dataclass(frozen=True)
class StepFramesXpose6:
    op: Literal["frames.xpose6"]
    m1: list[list[float]]


@dataclass(frozen=True)
class StepFramesSxform:
    op: Literal["frames.sxform"]
    from_: str
    to: str
    et: float
