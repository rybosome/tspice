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
