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
