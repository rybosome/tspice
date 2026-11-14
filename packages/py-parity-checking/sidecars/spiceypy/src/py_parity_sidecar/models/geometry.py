from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StoredEllipse:
    center: tuple[float, float, float]
    semiMajor: tuple[float, float, float]
    semiMinor: tuple[float, float, float]


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
class StepGeometryNvp2pl:
    op: Literal["geometry.nvp2pl"]
    normal: tuple[float, float, float]
    point: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryPl2nvp:
    op: Literal["geometry.pl2nvp"]
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryPl2psv:
    op: Literal["geometry.pl2psv"]
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryPsv2pl:
    op: Literal["geometry.psv2pl"]
    point: tuple[float, float, float]
    span1: tuple[float, float, float]
    span2: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryInrypl:
    op: Literal["geometry.inrypl"]
    vertex: tuple[float, float, float]
    dir: tuple[float, float, float]
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryVprjp:
    op: Literal["geometry.vprjp"]
    vin: tuple[float, float, float]
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryVprjpi:
    op: Literal["geometry.vprjpi"]
    vin: tuple[float, float, float]
    projpl: tuple[float, float, float, float]
    invpl: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryNplnpt:
    op: Literal["geometry.nplnpt"]
    linpt: tuple[float, float, float]
    lindir: tuple[float, float, float]
    point: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryCgv2el:
    op: Literal["geometry.cgv2el"]
    center: tuple[float, float, float]
    vec1: tuple[float, float, float]
    vec2: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryEl2cgv:
    op: Literal["geometry.el2cgv"]
    ellipse: StoredEllipse


@dataclass(frozen=True)
class StepGeometrySaelgv:
    op: Literal["geometry.saelgv"]
    vec1: tuple[float, float, float]
    vec2: tuple[float, float, float]


@dataclass(frozen=True)
class StepGeometryPjelpl:
    op: Literal["geometry.pjelpl"]
    ellipse: StoredEllipse
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryInelpl:
    op: Literal["geometry.inelpl"]
    ellipse: StoredEllipse
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryInedpl:
    op: Literal["geometry.inedpl"]
    a: float
    b: float
    c: float
    plane: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepGeometryNpelpt:
    op: Literal["geometry.npelpt"]
    point: tuple[float, float, float]
    ellipse: StoredEllipse


@dataclass(frozen=True)
class StepGeometryNvc2pl:
    op: Literal["geometry.nvc2pl"]
    normal: tuple[float, float, float]
    konst: float


@dataclass(frozen=True)
class StepGeometryPl2nvc:
    op: Literal["geometry.pl2nvc"]
    plane: tuple[float, float, float, float]
