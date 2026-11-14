from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

Vec3: TypeAlias = tuple[float, float, float]
Matrix3x3: TypeAlias = list[list[float]]


@dataclass(frozen=True)
class StepCoordsVectorsDet:
    op: Literal["coords-vectors.det"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsDiags2:
    op: Literal["coords-vectors.diags2"]
    symmat: tuple[float, float, float, float]


@dataclass(frozen=True)
class StepCoordsVectorsIdent:
    op: Literal["coords-vectors.ident"]


@dataclass(frozen=True)
class StepCoordsVectorsInvert:
    op: Literal["coords-vectors.invert"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsInvort:
    op: Literal["coords-vectors.invort"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsIsrot:
    op: Literal["coords-vectors.isrot"]
    m: Matrix3x3
    ntol: float
    dtol: float


@dataclass(frozen=True)
class StepCoordsVectorsMequ:
    op: Literal["coords-vectors.mequ"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsMtxm:
    op: Literal["coords-vectors.mtxm"]
    a: Matrix3x3
    b: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsMxmt:
    op: Literal["coords-vectors.mxmt"]
    a: Matrix3x3
    b: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsTrace:
    op: Literal["coords-vectors.trace"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsXpose:
    op: Literal["coords-vectors.xpose"]
    m: Matrix3x3


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
