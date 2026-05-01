from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepGeometryGfGfsstp:
    op: Literal["geometry-gf.gfsstp"]
    step: float


@dataclass(frozen=True)
class StepGeometryGfGfstep:
    op: Literal["geometry-gf.gfstep"]
    time: float


@dataclass(frozen=True)
class StepGeometryGfGfstol:
    op: Literal["geometry-gf.gfstol"]
    value: float


@dataclass(frozen=True)
class StepGeometryGfGfrefn:
    op: Literal["geometry-gf.gfrefn"]
    t1: float
    t2: float
    s1: bool
    s2: bool


@dataclass(frozen=True)
class StepGeometryGfGfrepi:
    op: Literal["geometry-gf.gfrepi"]
    windowId: str
    begmss: str
    endmss: str


@dataclass(frozen=True)
class StepGeometryGfGfrepf:
    op: Literal["geometry-gf.gfrepf"]


@dataclass(frozen=True)
class StepGeometryGfGfsep:
    op: Literal["geometry-gf.gfsep"]
    targ1: str
    shape1: str
    frame1: str
    targ2: str
    shape2: str
    frame2: str
    abcorr: str
    obsrvr: str
    relate: str
    refval: float
    adjust: float
    step: float
    nintvls: int
    cnfineWindowId: str
    resultWindowId: str


@dataclass(frozen=True)
class StepGeometryGfGfdist:
    op: Literal["geometry-gf.gfdist"]
    target: str
    abcorr: str
    obsrvr: str
    relate: str
    refval: float
    adjust: float
    step: float
    nintvls: int
    cnfineWindowId: str
    resultWindowId: str
