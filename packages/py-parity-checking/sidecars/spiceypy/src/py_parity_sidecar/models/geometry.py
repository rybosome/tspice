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
class StepGeometryLatsrf:
    op: Literal["geometry.latsrf"]
    method: str
    target: str
    et: float
    fixref: str
    lonlat: list[tuple[float,float]]


@dataclass(frozen=True)
class StepGeometrySrfnrm:
    op: Literal["geometry.srfnrm"]
    method: str
    target: str
    et: float
    fixref: str
    srfpts: list[tuple[float,float,float]]


@dataclass(frozen=True)
class StepGeometryLimbpt:
    op: Literal["geometry.limbpt"]
    method: str
    target: str
    et: float
    fixref: str
    abcorr: str
    corloc: str
    observer: str
    refvec: tuple[float,float,float]
    rolstp: float
    ncuts: int
    schstp: float
    soltol: float
    maxn: int


@dataclass(frozen=True)
class StepGeometryTermpt:
    op: Literal["geometry.termpt"]
    method: str
    ilusrc: str
    target: str
    et: float
    fixref: str
    abcorr: str
    corloc: str
    observer: str
    refvec: tuple[float,float,float]
    rolstp: float
    ncuts: int
    schstp: float
    soltol: float
    maxn: int


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
