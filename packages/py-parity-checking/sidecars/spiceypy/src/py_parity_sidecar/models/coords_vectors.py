from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

Vec2: TypeAlias = tuple[float, float]
Vec3: TypeAlias = tuple[float, float, float]
Matrix3x3: TypeAlias = list[list[float]]


@dataclass(frozen=True)
class StepCoordsVectorsChbder:
    op: Literal["coords-vectors.chbder"]
    cp: list[float]
    x2s: Vec2
    x: float
    nderiv: int


@dataclass(frozen=True)
class StepCoordsVectorsChbigr:
    op: Literal["coords-vectors.chbigr"]
    cp: list[float]
    x2s: Vec2
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsChbint:
    op: Literal["coords-vectors.chbint"]
    cp: list[float]
    x2s: Vec2
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsChbval:
    op: Literal["coords-vectors.chbval"]
    cp: list[float]
    x2s: Vec2
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsPolyds:
    op: Literal["coords-vectors.polyds"]
    coeffs: list[float]
    nderiv: int
    t: float


@dataclass(frozen=True)
class StepCoordsVectorsRquad:
    op: Literal["coords-vectors.rquad"]
    a: float
    b: float
    c: float


@dataclass(frozen=True)
class StepCoordsVectorsReclat:
    op: Literal["coords-vectors.reclat"]
    rectan: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsLatrec:
    op: Literal["coords-vectors.latrec"]
    radius: float
    lon: float
    lat: float


@dataclass(frozen=True)
class StepCoordsVectorsRecsph:
    op: Literal["coords-vectors.recsph"]
    rectan: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsSphrec:
    op: Literal["coords-vectors.sphrec"]
    radius: float
    colat: float
    lon: float


@dataclass(frozen=True)
class StepCoordsVectorsVnorm:
    op: Literal["coords-vectors.vnorm"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVhat:
    op: Literal["coords-vectors.vhat"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVdot:
    op: Literal["coords-vectors.vdot"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVcrss:
    op: Literal["coords-vectors.vcrss"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVadd:
    op: Literal["coords-vectors.vadd"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVsub:
    op: Literal["coords-vectors.vsub"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVminus:
    op: Literal["coords-vectors.vminus"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVscl:
    op: Literal["coords-vectors.vscl"]
    s: float
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsMxm:
    op: Literal["coords-vectors.mxm"]
    m1: Matrix3x3
    m2: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsRotate:
    op: Literal["coords-vectors.rotate"]
    angle: float
    axis: int


@dataclass(frozen=True)
class StepCoordsVectorsRotmat:
    op: Literal["coords-vectors.rotmat"]
    m: Matrix3x3
    angle: float
    axis: int


@dataclass(frozen=True)
class StepCoordsVectorsAxisar:
    op: Literal["coords-vectors.axisar"]
    axis: Vec3
    angle: float


@dataclass(frozen=True)
class StepCoordsVectorsGeorec:
    op: Literal["coords-vectors.georec"]
    lon: float
    lat: float
    alt: float
    re: float
    f: float


@dataclass(frozen=True)
class StepCoordsVectorsRecgeo:
    op: Literal["coords-vectors.recgeo"]
    rectan: Vec3
    re: float
    f: float


@dataclass(frozen=True)
class StepCoordsVectorsMxv:
    op: Literal["coords-vectors.mxv"]
    m: Matrix3x3
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsMtxv:
    op: Literal["coords-vectors.mtxv"]
    m: Matrix3x3
    v: Vec3
