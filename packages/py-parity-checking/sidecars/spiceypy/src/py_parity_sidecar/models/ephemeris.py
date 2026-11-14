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
