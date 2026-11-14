from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .paths import PathRefInput


@dataclass(frozen=True)
class StepEphemerisSpkcls:
    op: Literal["ephemeris.spkcls"]
    handleId: str
    captureError: bool = False


@dataclass(frozen=True)
class StepEphemerisSpkcov:
    op: Literal["ephemeris.spkcov"]
    spk: PathRefInput
    idcode: int
    coverWindowId: str
    maxIntervals: int | None = None


@dataclass(frozen=True)
class StepEphemerisSpkez:
    op: Literal["ephemeris.spkez"]
    target: int
    et: float
    ref: str
    abcorr: str
    observer: int


@dataclass(frozen=True)
class StepEphemerisSpkezp:
    op: Literal["ephemeris.spkezp"]
    target: int
    et: float
    ref: str
    abcorr: str
    observer: int


@dataclass(frozen=True)
class StepEphemerisSpkezr:
    op: Literal["ephemeris.spkezr"]
    target: str
    et: float
    ref: str
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepEphemerisSpkgeo:
    op: Literal["ephemeris.spkgeo"]
    target: int
    et: float
    ref: str
    observer: int


@dataclass(frozen=True)
class StepEphemerisSpkgps:
    op: Literal["ephemeris.spkgps"]
    target: int
    et: float
    ref: str
    observer: int


@dataclass(frozen=True)
class StepEphemerisSpkobj:
    op: Literal["ephemeris.spkobj"]
    spk: PathRefInput
    idsCellId: str
    maxCardinality: int | None = None


@dataclass(frozen=True)
class StepEphemerisSpkopa:
    op: Literal["ephemeris.spkopa"]
    file: PathRefInput
    handleId: str


@dataclass(frozen=True)
class StepEphemerisSpkopn:
    op: Literal["ephemeris.spkopn"]
    file: PathRefInput
    ifname: str
    ncomch: int
    handleId: str


@dataclass(frozen=True)
class StepEphemerisSpkpds:
    op: Literal["ephemeris.spkpds"]
    body: int
    center: int
    frame: str
    type: int
    first: float
    last: float
    descrId: str | None = None


@dataclass(frozen=True)
class StepEphemerisSpkpos:
    op: Literal["ephemeris.spkpos"]
    target: str
    et: float
    ref: str
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepEphemerisSpksfs:
    op: Literal["ephemeris.spksfs"]
    body: int
    et: float
    descrId: str | None = None


@dataclass(frozen=True)
class StepEphemerisSpkssb:
    op: Literal["ephemeris.spkssb"]
    target: int
    et: float
    ref: str


@dataclass(frozen=True)
class StepEphemerisSpkuds:
    op: Literal["ephemeris.spkuds"]
    descr: tuple[float, float, float, float, float] | None = None
    descrId: str | None = None


@dataclass(frozen=True)
class StepEphemerisSpkw08:
    op: Literal["ephemeris.spkw08"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    degree: int
    states: list[float]
    epoch1: float
    step: float


@dataclass(frozen=True)
class StepEphemerisSpkw02:
    op: Literal["ephemeris.spkw02"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    intlen: float
    n: int
    degree: int
    cdata: list[float]
    btime: float


@dataclass(frozen=True)
class StepEphemerisSpkw03:
    op: Literal["ephemeris.spkw03"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    intlen: float
    n: int
    degree: int
    cdata: list[float]
    btime: float


@dataclass(frozen=True)
class StepEphemerisSpkw20:
    op: Literal["ephemeris.spkw20"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    intlen: float
    n: int
    degree: int
    cdata: list[float]
    dscale: float
    tscale: float
    initjd: float
    initfr: float


@dataclass(frozen=True)
class StepEphemerisSpkw05:
    op: Literal["ephemeris.spkw05"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    gm: float
    states: list[float]
    epochs: list[float]


@dataclass(frozen=True)
class StepEphemerisSpkw10:
    op: Literal["ephemeris.spkw10"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    consts: list[float]
    elems: list[float]
    epochs: list[float]


@dataclass(frozen=True)
class StepEphemerisSpkw15:
    op: Literal["ephemeris.spkw15"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    epoch: float
    tp: tuple[float,float,float]
    pa: tuple[float,float,float]
    p: float
    ecc: float
    j2flg: float
    pv: tuple[float,float,float]
    gm: float
    j2: float
    radius: float


@dataclass(frozen=True)
class StepEphemerisSpkw17:
    op: Literal["ephemeris.spkw17"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    epoch: float
    eqel: list[float]
    rapol: float
    decpol: float
