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
