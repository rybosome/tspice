from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .paths import PathRefInput

Vec3 = tuple[float, float, float]
IndexTriple = tuple[int, int, int]


@dataclass(frozen=True)
class StepDskDskobj:
    op: Literal["dsk.dskobj"]
    path: PathRefInput
    cellSize: int = 10000
    initial: list[int] = field(default_factory=list)
    repetitions: int = 1


@dataclass(frozen=True)
class StepDskDsksrf:
    op: Literal["dsk.dsksrf"]
    path: PathRefInput
    bodyid: int
    cellSize: int = 10000
    initial: list[int] = field(default_factory=list)
    repetitions: int = 1


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
class StepDskDskd02:
    op: Literal["dsk.dskd02"]
    handleId: str
    dladscId: str
    item: int
    start: int
    room: int


@dataclass(frozen=True)
class StepDskDski02:
    op: Literal["dsk.dski02"]
    handleId: str
    dladscId: str
    item: int
    start: int
    room: int


@dataclass(frozen=True)
class StepDskIllumPl02:
    op: Literal["dsk.illum_pl02"]
    handleId: str
    dladscId: str
    target: str
    et: float
    abcorr: str
    obsrvr: str
    spoint: tuple[float,float,float]


@dataclass(frozen=True)
class StepDskIllumPlidPl02:
    op: Literal["dsk.illum_plid_pl02"]
    handleId: str
    dladscId: str
    target: str
    et: float
    abcorr: str
    obsrvr: str
    spoint: tuple[float,float,float]
    plid: int


@dataclass(frozen=True)
class StepDskLimbPl02:
    op: Literal["dsk.limb_pl02"]
    handleId: str
    dladscId: str
    target: str
    et: float
    fixref: str
    abcorr: str
    obsrvr: str
    npts: int


@dataclass(frozen=True)
class StepDskLlgridPl02:
    op: Literal["dsk.llgrid_pl02"]
    handleId: str
    dladscId: str
    grid: list[tuple[float,float]]


@dataclass(frozen=True)
class StepDskSubptPl02:
    op: Literal["dsk.subpt_pl02"]
    handleId: str
    dladscId: str
    method: str
    target: str
    et: float
    abcorr: str
    obsrvr: str


@dataclass(frozen=True)
class StepDskSubsolPl02:
    op: Literal["dsk.subsol_pl02"]
    handleId: str
    dladscId: str
    method: str
    target: str
    et: float
    abcorr: str
    obsrvr: str


@dataclass(frozen=True)
class StepDskTermPl02:
    op: Literal["dsk.term_pl02"]
    handleId: str
    dladscId: str
    trmtyp: str
    source: str
    target: str
    et: float
    fixref: str
    abcorr: str
    obsrvr: str
    npts: int


@dataclass(frozen=True)
class StepDskDskx02:
    op: Literal["dsk.dskx02"]
    handleId: str
    dladscId: str
    vertex: tuple[float,float,float]
    raydir: tuple[float,float,float]


@dataclass(frozen=True)
class StepDskDskxsi:
    op: Literal["dsk.dskxsi"]
    pri: bool
    target: str
    srflst: list[int]
    et: float
    fixref: str
    vertex: tuple[float,float,float]
    raydir: tuple[float,float,float]
    maxd: int
    maxi: int


@dataclass(frozen=True)
class StepDskDskxv:
    op: Literal["dsk.dskxv"]
    pri: bool
    target: str
    srflst: list[int]
    et: float
    fixref: str
    vertices: list[tuple[float,float,float]]
    dirs: list[tuple[float,float,float]]


@dataclass(frozen=True)
class StepDskDskgtl:
    op: Literal["dsk.dskgtl"]
    key: int


@dataclass(frozen=True)
class StepDskDskstl:
    op: Literal["dsk.dskstl"]
    key: int
    value: float


@dataclass(frozen=True)
class StepDskDskn02:
    op: Literal["dsk.dskn02"]
    handleId: str
    dladscId: str
    plid: int


@dataclass(frozen=True)
class StepDskDskp02:
    op: Literal["dsk.dskp02"]
    handleId: str
    dladscId: str
    start: int
    room: int


@dataclass(frozen=True)
class StepDskDskv02:
    op: Literal["dsk.dskv02"]
    handleId: str
    dladscId: str
    start: int
    room: int


@dataclass(frozen=True)
class StepDskDskz02:
    op: Literal["dsk.dskz02"]
    handleId: str
    dladscId: str


@dataclass(frozen=True)
class StepDskDskcls:
    op: Literal["dsk.dskcls"]
    handleId: str
    optmiz: bool


@dataclass(frozen=True)
class StepDskDlafns:
    op: Literal["dsk.dlafns"]
    handleId: str
    dladscId: str
    nextId: str


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
