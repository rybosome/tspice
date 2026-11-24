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
class StepEphemerisConics:
    op: Literal["ephemeris.conics"]
    elts: list[float]
    et: float


@dataclass(frozen=True)
class StepEphemerisEqncpv:
    op: Literal["ephemeris.eqncpv"]
    et: float
    epoch: float
    eqel: list[float]
    rapol: float
    decpol: float


@dataclass(frozen=True)
class StepEphemerisOscelt:
    op: Literal["ephemeris.oscelt"]
    state: list[float]
    et: float
    mu: float


@dataclass(frozen=True)
class StepEphemerisOscltx:
    op: Literal["ephemeris.oscltx"]
    state: list[float]
    et: float
    mu: float


@dataclass(frozen=True)
class StepEphemerisProp2b:
    op: Literal["ephemeris.prop2b"]
    gm: float
    pvinit: list[float]
    dt: float


@dataclass(frozen=True)
class StepEphemerisGetelm:
    op: Literal["ephemeris.getelm"]
    firstYear: int
    lines: list[str]
    captureError: bool = False


@dataclass(frozen=True)
class StepEphemerisEvsgp4:
    op: Literal["ephemeris.evsgp4"]
    et: float
    geophs: list[float]
    elems: list[float]
    captureError: bool = False


@dataclass(frozen=True)
class StepEphemerisSpkcpo:
    op: Literal["ephemeris.spkcpo"]
    target: str
    et: float
    outref: str
    refloc: str
    abcorr: str
    obspos: list[float]
    obsctr: str
    obsref: str


@dataclass(frozen=True)
class StepEphemerisSpkcpt:
    op: Literal["ephemeris.spkcpt"]
    trgpos: list[float]
    trgctr: str
    trgref: str
    et: float
    outref: str
    refloc: str
    abcorr: str
    obsrvr: str


@dataclass(frozen=True)
class StepEphemerisSpkcvo:
    op: Literal["ephemeris.spkcvo"]
    target: str
    et: float
    outref: str
    refloc: str
    abcorr: str
    obssta: list[float]
    obsepc: float
    obsctr: str
    obsref: str


@dataclass(frozen=True)
class StepEphemerisSpkcvt:
    op: Literal["ephemeris.spkcvt"]
    trgsta: list[float]
    trgepc: float
    trgctr: str
    trgref: str
    et: float
    outref: str
    refloc: str
    abcorr: str
    obsrvr: str


@dataclass(frozen=True)
class StepEphemerisAzlcpo:
    op: Literal["ephemeris.azlcpo"]
    method: str
    target: str
    et: float
    abcorr: str
    azccw: bool
    elplsz: bool
    obspos: list[float]
    obsctr: str
    obsref: str


@dataclass(frozen=True)
class StepEphemerisSpkacs:
    op: Literal["ephemeris.spkacs"]
    target: int
    et: float
    ref: str
    abcorr: str
    observer: int


@dataclass(frozen=True)
class StepEphemerisSpkapo:
    op: Literal["ephemeris.spkapo"]
    target: int
    et: float
    ref: str
    observerState: list[float]
    abcorr: str


@dataclass(frozen=True)
class StepEphemerisSpkapp:
    op: Literal["ephemeris.spkapp"]
    target: int
    et: float
    ref: str
    observerState: list[float]
    abcorr: str


@dataclass(frozen=True)
class StepEphemerisSpkaps:
    op: Literal["ephemeris.spkaps"]
    target: int
    et: float
    ref: str
    abcorr: str
    observerState: list[float]
    observerAcceleration: list[float]


@dataclass(frozen=True)
class StepEphemerisSpkltc:
    op: Literal["ephemeris.spkltc"]
    target: int
    et: float
    ref: str
    abcorr: str
    observerState: list[float]


@dataclass(frozen=True)
class StepEphemerisStelab:
    op: Literal["ephemeris.stelab"]
    position: list[float]
    observerVelocity: list[float]


@dataclass(frozen=True)
class StepEphemerisStlabx:
    op: Literal["ephemeris.stlabx"]
    position: list[float]
    observerVelocity: list[float]


@dataclass(frozen=True)
class StepEphemerisLtime:
    op: Literal["ephemeris.ltime"]
    etobs: float
    observer: int
    dir: str
    target: int


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
class StepEphemerisSpklef:
    op: Literal["ephemeris.spklef"]
    file: PathRefInput
    id: str


@dataclass(frozen=True)
class StepEphemerisSpkuef:
    op: Literal["ephemeris.spkuef"]
    id: str


@dataclass(frozen=True)
class StepEphemerisSpkpvn:
    op: Literal["ephemeris.spkpvn"]
    source: str
    descriptor: str
    et: float
    mode: str


@dataclass(frozen=True)
class StepEphemerisSpksub:
    op: Literal["ephemeris.spksub"]
    source: str
    descriptor: str
    ident: str
    begin: float
    end: float
    writer: str
    mode: str


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
class StepEphemerisSpkw09:
    op: Literal["ephemeris.spkw09"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    degree: int
    states: list[float]
    epochs: list[float]


@dataclass(frozen=True)
class StepEphemerisSpkw12:
    op: Literal["ephemeris.spkw12"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    degree: int
    states: list[float]
    epoch0: float
    step: float


@dataclass(frozen=True)
class StepEphemerisSpkw13:
    op: Literal["ephemeris.spkw13"]
    handleId: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    degree: int
    states: list[float]
    epochs: list[float]


@dataclass(frozen=True)
class StepEphemerisSpkw18:
    op: Literal["ephemeris.spkw18"]
    handleId: str
    subtype: int
    body: int
    center: int
    frame: str
    first: float
    last: float
    segid: str
    degree: int
    packets: list[float]
    epochs: list[float]


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


@dataclass(frozen=True)
class StepEphemerisSpk14b:
    op: Literal["ephemeris.spk14b"]
    handleId: str
    segid: str
    body: int
    center: int
    frame: str
    first: float
    last: float
    degree: int


@dataclass(frozen=True)
class StepEphemerisSpk14a:
    op: Literal["ephemeris.spk14a"]
    handleId: str
    count: int
    records: list[float]
    epochs: list[float]


@dataclass(frozen=True)
class StepEphemerisSpk14e:
    op: Literal["ephemeris.spk14e"]
    handleId: str
