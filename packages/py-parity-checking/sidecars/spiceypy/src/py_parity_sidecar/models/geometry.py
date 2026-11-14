from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepGeometrySubpnt:
    op: Literal["geometry.subpnt"]
    method: str
    target: str
    et: float
    fixref: str
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepGeometrySubslr:
    op: Literal["geometry.subslr"]
    method: str
    target: str
    et: float
    fixref: str
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepGeometrySincpt:
    op: Literal["geometry.sincpt"]
    method: str
    target: str
    et: float
    fixref: str
    abcorr: str
    observer: str
    dref: str
    dvec: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryIlumin:
    op: Literal["geometry.ilumin"]
    method: str
    target: str
    et: float
    fixref: str
    abcorr: str
    observer: str
    spoint: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryIllumg:
    op: Literal["geometry.illumg"]
    method: str
    target: str
    ilusrc: str
    et: float
    fixref: str
    abcorr: str
    observer: str
    spoint: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryIllumf:
    op: Literal["geometry.illumf"]
    method: str
    target: str
    ilusrc: str
    et: float
    fixref: str
    abcorr: str
    observer: str
    spoint: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryPhaseq:
    op: Literal["geometry.phaseq"]
    et: float
    target: str
    illmn: str
    observer: str
    abcorr: str


@dataclass(frozen=True)
class StepGeometryLspcn:
    op: Literal["geometry.lspcn"]
    body: str
    et: float
    abcorr: str


@dataclass(frozen=True)
class StepGeometryTrgsep:
    op: Literal["geometry.trgsep"]
    et: float
    targ1: str
    shape1: str
    frame1: str
    targ2: str
    shape2: str
    frame2: str
    observer: str
    abcorr: str


@dataclass(frozen=True)
class StepGeometryIllum:
    op: Literal["geometry.illum"]
    target: str
    et: float
    abcorr: str
    observer: str
    spoint: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometrySrfxpt:
    op: Literal["geometry.srfxpt"]
    method: str
    target: str
    et: float
    abcorr: str
    observer: str
    dref: str
    dvec: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometrySubpt:
    op: Literal["geometry.subpt"]
    method: str
    target: str
    et: float
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepGeometrySubsol:
    op: Literal["geometry.subsol"]
    method: str
    target: str
    et: float
    abcorr: str
    observer: str


@dataclass(frozen=True)
class StepGeometryEdterm:
    op: Literal["geometry.edterm"]
    trmtyp: str
    source: str
    target: str
    et: float
    fixref: str
    abcorr: str
    observer: str
    npts: int


@dataclass(frozen=True)
class StepGeometryOccult:
    op: Literal["geometry.occult"]
    targ1: str
    shape1: str
    frame1: str
    targ2: str
    shape2: str
    frame2: str
    abcorr: str
    observer: str
    et: float


@dataclass(frozen=True)
class StepGeometryNvc2pl:
    op: Literal["geometry.nvc2pl"]
    normal: tuple[float, float, float]
    konst: float


@dataclass(frozen=True)
class StepGeometryPl2nvc:
    op: Literal["geometry.pl2nvc"]
    plane: tuple[float, float, float, float]
