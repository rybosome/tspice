from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

TimdefItem: TypeAlias = str
TkvrsnItem: TypeAlias = str
DeltetEptype: TypeAlias = Literal["ET", "UTC"]


@dataclass(frozen=True)
class StepTimeStr2Et:
    op: Literal["time.str2et"]
    time: str


@dataclass(frozen=True)
class StepTimeEt2Utc:
    op: Literal["time.et2utc"]
    et: float
    format: str
    prec: int


@dataclass(frozen=True)
class StepTimeB1900:
    op: Literal["time.b1900"]


@dataclass(frozen=True)
class StepTimeJ1950:
    op: Literal["time.j1950"]


@dataclass(frozen=True)
class StepTimeJ2100:
    op: Literal["time.j2100"]


@dataclass(frozen=True)
class StepTimeJyear:
    op: Literal["time.jyear"]


@dataclass(frozen=True)
class StepTimeTyear:
    op: Literal["time.tyear"]


@dataclass(frozen=True)
class StepTimeTkvrsn:
    op: Literal["time.tkvrsn"]
    item: TkvrsnItem


@dataclass(frozen=True)
class StepTimeTimout:
    op: Literal["time.timout"]
    et: float
    picture: str


@dataclass(frozen=True)
class StepTimeDeltet:
    op: Literal["time.deltet"]
    epoch: float
    eptype: DeltetEptype


@dataclass(frozen=True)
class StepTimeUnitim:
    op: Literal["time.unitim"]
    epoch: float
    insys: str
    outsys: str


@dataclass(frozen=True)
class StepTimeTparse:
    op: Literal["time.tparse"]
    timstr: str


@dataclass(frozen=True)
class StepTimeTpictr:
    op: Literal["time.tpictr"]
    sample: str
    pictur: str


@dataclass(frozen=True)
class StepTimeTimdefGet:
    op: Literal["time.timdef"]
    action: Literal["GET"]
    item: TimdefItem


@dataclass(frozen=True)
class StepTimeTimdefSet:
    op: Literal["time.timdef"]
    action: Literal["SET"]
    item: TimdefItem
    value: str


@dataclass(frozen=True)
class StepTimeScs2e:
    op: Literal["time.scs2e"]
    sc: int
    sclkch: str


@dataclass(frozen=True)
class StepTimeSce2s:
    op: Literal["time.sce2s"]
    sc: int
    et: float


@dataclass(frozen=True)
class StepTimeScencd:
    op: Literal["time.scencd"]
    sc: int
    sclkch: str


@dataclass(frozen=True)
class StepTimeScdecd:
    op: Literal["time.scdecd"]
    sc: int
    sclkdp: float


@dataclass(frozen=True)
class StepTimeSct2e:
    op: Literal["time.sct2e"]
    sc: int
    sclkdp: float


@dataclass(frozen=True)
class StepTimeSce2c:
    op: Literal["time.sce2c"]
    sc: int
    et: float
