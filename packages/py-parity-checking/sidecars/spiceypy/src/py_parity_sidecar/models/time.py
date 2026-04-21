from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

TimdefItem: TypeAlias = Literal["SYSTEM", "CALENDAR", "ZONE"]


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
