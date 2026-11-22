from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

Vec6: TypeAlias = tuple[float, float, float, float, float, float]
Vec2: TypeAlias = tuple[float, float]
Vec3: TypeAlias = tuple[float, float, float]
Matrix3x3: TypeAlias = list[list[float]]


@dataclass(frozen=True)
class StepCoordsVectorsCyllat:
    op: Literal["coords-vectors.cyllat"]
    radius: float
    lon: float
    z: float


@dataclass(frozen=True)
class StepCoordsVectorsCylrec:
    op: Literal["coords-vectors.cylrec"]
    radius: float
    lon: float
    z: float


@dataclass(frozen=True)
class StepCoordsVectorsCylsph:
    op: Literal["coords-vectors.cylsph"]
    radius: float
    lon: float
    z: float


@dataclass(frozen=True)
class StepCoordsVectorsLatcyl:
    op: Literal["coords-vectors.latcyl"]
    radius: float
    lon: float
    lat: float


@dataclass(frozen=True)
class StepCoordsVectorsLatsph:
    op: Literal["coords-vectors.latsph"]
    radius: float
    lon: float
    lat: float


@dataclass(frozen=True)
class StepCoordsVectorsReccyl:
    op: Literal["coords-vectors.reccyl"]
    rectan: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsSphcyl:
    op: Literal["coords-vectors.sphcyl"]
    radius: float
    colat: float
    lon: float


@dataclass(frozen=True)
class StepCoordsVectorsSphlat:
    op: Literal["coords-vectors.sphlat"]
    radius: float
    colat: float
    lon: float


@dataclass(frozen=True)
class StepCoordsVectorsVdist:
    op: Literal["coords-vectors.vdist"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVequ:
    op: Literal["coords-vectors.vequ"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVpack:
    op: Literal["coords-vectors.vpack"]
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class StepCoordsVectorsVupack:
    op: Literal["coords-vectors.vupack"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVzero:
    op: Literal["coords-vectors.vzero"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsUnorm:
    op: Literal["coords-vectors.unorm"]
    v: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsUcrss:
    op: Literal["coords-vectors.ucrss"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVsep:
    op: Literal["coords-vectors.vsep"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVlcom:
    op: Literal["coords-vectors.vlcom"]
    a: float
    v1: Vec3
    b: float
    v2: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVlcom3:
    op: Literal["coords-vectors.vlcom3"]
    a: float
    v1: Vec3
    b: float
    v2: Vec3
    c: float
    v3: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVperp:
    op: Literal["coords-vectors.vperp"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVproj:
    op: Literal["coords-vectors.vproj"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVrel:
    op: Literal["coords-vectors.vrel"]
    a: Vec3
    b: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsVrotv:
    op: Literal["coords-vectors.vrotv"]
    v: Vec3
    axis: Vec3
    theta: float


@dataclass(frozen=True)
class StepCoordsVectorsRotvec:
    op: Literal["coords-vectors.rotvec"]
    v: Vec3
    angle: float
    axis: int


@dataclass(frozen=True)
class StepCoordsVectorsVtmv:
    op: Literal["coords-vectors.vtmv"]
    v1: Vec3
    matrix: Matrix3x3
    v2: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsAzlrec:
    op: Literal["coords-vectors.azlrec"]
    range: float
    az: float
    el: float
    azccw: bool
    elplsz: bool


@dataclass(frozen=True)
class StepCoordsVectorsRecazl:
    op: Literal["coords-vectors.recazl"]
    rect: Vec3
    azccw: bool
    elplsz: bool


@dataclass(frozen=True)
class StepCoordsVectorsPgrrec:
    op: Literal["coords-vectors.pgrrec"]
    body: str
    lon: float
    lat: float
    alt: float
    re: float
    f: float


@dataclass(frozen=True)
class StepCoordsVectorsRecpgr:
    op: Literal["coords-vectors.recpgr"]
    body: str
    rect: Vec3
    re: float
    f: float


@dataclass(frozen=True)
class StepCoordsVectorsRadrec:
    op: Literal["coords-vectors.radrec"]
    range: float
    ra: float
    dec: float


@dataclass(frozen=True)
class StepCoordsVectorsRecrad:
    op: Literal["coords-vectors.recrad"]
    rect: Vec3


@dataclass(frozen=True)
class StepCoordsVectorsSrfrec:
    op: Literal["coords-vectors.srfrec"]
    body: int
    lon: float
    lat: float


@dataclass(frozen=True)
class StepCoordsVectorsBrcktd:
    op: Literal["coords-vectors.brcktd"]
    value: float
    end1: float
    end2: float


@dataclass(frozen=True)
class StepCoordsVectorsBrckti:
    op: Literal["coords-vectors.brckti"]
    value: int
    end1: int
    end2: int


@dataclass(frozen=True)
class StepCoordsVectorsConvrt:
    op: Literal["coords-vectors.convrt"]
    value: float
    inUnit: str
    outUnit: str


@dataclass(frozen=True)
class StepCoordsVectorsSumad:
    op: Literal["coords-vectors.sumad"]
    values: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsSumai:
    op: Literal["coords-vectors.sumai"]
    values: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsMaxd:
    op: Literal["coords-vectors.maxd"]
    values: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsMaxi:
    op: Literal["coords-vectors.maxi"]
    values: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsMind:
    op: Literal["coords-vectors.mind"]
    values: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsMini:
    op: Literal["coords-vectors.mini"]
    values: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsDucrss:
    op: Literal["coords-vectors.ducrss"]
    a: Vec6
    b: Vec6


@dataclass(frozen=True)
class StepCoordsVectorsDvcrss:
    op: Literal["coords-vectors.dvcrss"]
    a: Vec6
    b: Vec6


@dataclass(frozen=True)
class StepCoordsVectorsDvdot:
    op: Literal["coords-vectors.dvdot"]
    a: Vec6
    b: Vec6


@dataclass(frozen=True)
class StepCoordsVectorsDvhat:
    op: Literal["coords-vectors.dvhat"]
    state: Vec6


@dataclass(frozen=True)
class StepCoordsVectorsDvnorm:
    op: Literal["coords-vectors.dvnorm"]
    state: Vec6


@dataclass(frozen=True)
class StepCoordsVectorsDvsep:
    op: Literal["coords-vectors.dvsep"]
    a: Vec6
    b: Vec6


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
class StepCoordsVectorsHrmesp:
    op: Literal["coords-vectors.hrmesp"]
    first: float
    step: float
    yvals: list[float]
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsHrmint:
    op: Literal["coords-vectors.hrmint"]
    xvals: list[float]
    yvals: list[float]
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsLgresp:
    op: Literal["coords-vectors.lgresp"]
    first: float
    step: float
    yvals: list[float]
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsLgrind:
    op: Literal["coords-vectors.lgrind"]
    xvals: list[float]
    yvals: list[float]
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsLgrint:
    op: Literal["coords-vectors.lgrint"]
    xvals: list[float]
    yvals: list[float]
    x: float


@dataclass(frozen=True)
class StepCoordsVectorsQderiv:
    op: Literal["coords-vectors.qderiv"]
    f0: list[float]
    f2: list[float]
    delta: float


@dataclass(frozen=True)
class StepCoordsVectorsClearc:
    op: Literal["coords-vectors.clearc"]
    ndim: int
    arrlen: int
    bytes: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsCleard:
    op: Literal["coords-vectors.cleard"]
    ndim: int
    values: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsCleari:
    op: Literal["coords-vectors.cleari"]
    ndim: int
    values: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsFilld:
    op: Literal["coords-vectors.filld"]
    value: float
    ndim: int
    values: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsFilli:
    op: Literal["coords-vectors.filli"]
    value: int
    ndim: int
    values: list[int]


@dataclass(frozen=True)
class StepCoordsVectorsMoved:
    op: Literal["coords-vectors.moved"]
    source: list[float]
    ndim: int
    destination: list[float]


@dataclass(frozen=True)
class StepCoordsVectorsEul2m:
    op: Literal["coords-vectors.eul2m"]
    angle3: float
    angle2: float
    angle1: float
    axis3: int
    axis2: int
    axis1: int


@dataclass(frozen=True)
class StepCoordsVectorsM2eul:
    op: Literal["coords-vectors.m2eul"]
    m: Matrix3x3
    axis3: int
    axis2: int
    axis1: int


@dataclass(frozen=True)
class StepCoordsVectorsM2q:
    op: Literal["coords-vectors.m2q"]
    m: Matrix3x3


@dataclass(frozen=True)
class StepCoordsVectorsQ2m:
    op: Literal["coords-vectors.q2m"]
    q: tuple[float,float,float,float]


@dataclass(frozen=True)
class StepCoordsVectorsQxq:
    op: Literal["coords-vectors.qxq"]
    q1: tuple[float,float,float,float]
    q2: tuple[float,float,float,float]


@dataclass(frozen=True)
class StepCoordsVectorsQdq2av:
    op: Literal["coords-vectors.qdq2av"]
    q: tuple[float,float,float,float]
    dq: tuple[float,float,float,float]


@dataclass(frozen=True)
class StepCoordsVectorsRaxisa:
    op: Literal["coords-vectors.raxisa"]
    m: Matrix3x3


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
class StepCoordsVectorsMequg:
    op: Literal["coords-vectors.mequg"]
    m1: list[float]
    nr: int
    nc: int


@dataclass(frozen=True)
class StepCoordsVectorsMtxmg:
    op: Literal["coords-vectors.mtxmg"]
    m1: list[float]
    m2: list[float]
    nc1: int
    nr1r2: int
    nc2: int


@dataclass(frozen=True)
class StepCoordsVectorsMtxvg:
    op: Literal["coords-vectors.mtxvg"]
    m1: list[float]
    v2: list[float]
    nc1: int
    nr1r2: int


@dataclass(frozen=True)
class StepCoordsVectorsMxmg:
    op: Literal["coords-vectors.mxmg"]
    m1: list[float]
    m2: list[float]
    nr1: int
    nc1r2: int
    nc2: int


@dataclass(frozen=True)
class StepCoordsVectorsMxmtg:
    op: Literal["coords-vectors.mxmtg"]
    m1: list[float]
    m2: list[float]
    nr1: int
    nc1c2: int
    nr2: int


@dataclass(frozen=True)
class StepCoordsVectorsMxvg:
    op: Literal["coords-vectors.mxvg"]
    m1: list[float]
    v2: list[float]
    nr1: int
    nc1r2: int


@dataclass(frozen=True)
class StepCoordsVectorsVtmvg:
    op: Literal["coords-vectors.vtmvg"]
    v1: list[float]
    matrix: list[float]
    v2: list[float]
    nrow: int
    ncol: int


@dataclass(frozen=True)
class StepCoordsVectorsXposeg:
    op: Literal["coords-vectors.xposeg"]
    matrix: list[float]
    nrow: int
    ncol: int


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
class StepCoordsVectorsPi:
    op: Literal["coords-vectors.pi"]


@dataclass(frozen=True)
class StepCoordsVectorsTwopi:
    op: Literal["coords-vectors.twopi"]


@dataclass(frozen=True)
class StepCoordsVectorsHalfpi:
    op: Literal["coords-vectors.halfpi"]


@dataclass(frozen=True)
class StepCoordsVectorsDpr:
    op: Literal["coords-vectors.dpr"]


@dataclass(frozen=True)
class StepCoordsVectorsRpd:
    op: Literal["coords-vectors.rpd"]


@dataclass(frozen=True)
class StepCoordsVectorsClight:
    op: Literal["coords-vectors.clight"]


@dataclass(frozen=True)
class StepCoordsVectorsDpmax:
    op: Literal["coords-vectors.dpmax"]


@dataclass(frozen=True)
class StepCoordsVectorsDpmin:
    op: Literal["coords-vectors.dpmin"]


@dataclass(frozen=True)
class StepCoordsVectorsIntmax:
    op: Literal["coords-vectors.intmax"]


@dataclass(frozen=True)
class StepCoordsVectorsIntmin:
    op: Literal["coords-vectors.intmin"]


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
