from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

Vec3: TypeAlias = tuple[float, float, float]
Matrix3x3: TypeAlias = list[list[float]]


@dataclass(frozen=True)
class StepCoordsVectorsVaddg:
    op: Literal["coords-vectors.vaddg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVdistg:
    op: Literal["coords-vectors.vdistg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVdotg:
    op: Literal["coords-vectors.vdotg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVequg:
    op: Literal["coords-vectors.vequg"]
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVhatg:
    op: Literal["coords-vectors.vhatg"]
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVlcomg:
    op: Literal["coords-vectors.vlcomg"]
    a: float
    v1: list[float]
    b: float
    v2: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVminug:
    op: Literal["coords-vectors.vminug"]
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVnormg:
    op: Literal["coords-vectors.vnormg"]
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVprojg:
    op: Literal["coords-vectors.vprojg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVrelg:
    op: Literal["coords-vectors.vrelg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVsclg:
    op: Literal["coords-vectors.vsclg"]
    s: float
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVsepg:
    op: Literal["coords-vectors.vsepg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVsubg:
    op: Literal["coords-vectors.vsubg"]
    a: list[float]
    b: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsVzerog:
    op: Literal["coords-vectors.vzerog"]
    v: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsUnormg:
    op: Literal["coords-vectors.unormg"]
    v: list[float]


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
