from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepIdsNamesSrfc2s:
    op: Literal["ids-names.srfc2s"]
    code: int
    bodyId: int
    srflen: int


@dataclass(frozen=True)
class StepIdsNamesSrfcss:
    op: Literal["ids-names.srfcss"]
    code: int
    body: str
    srflen: int


@dataclass(frozen=True)
class StepIdsNamesSrfs2c:
    op: Literal["ids-names.srfs2c"]
    surface: str
    body: str


@dataclass(frozen=True)
class StepIdsNamesSrfscc:
    op: Literal["ids-names.srfscc"]
    surface: str
    bodyId: int


@dataclass(frozen=True)
class StepIdsNamesBodn2c:
    op: Literal["ids-names.bodn2c"]
    name: str


@dataclass(frozen=True)
class StepIdsNamesBodc2n:
    op: Literal["ids-names.bodc2n"]
    code: int


@dataclass(frozen=True)
class StepIdsNamesBodc2s:
    op: Literal["ids-names.bodc2s"]
    code: int


@dataclass(frozen=True)
class StepIdsNamesBoddef:
    op: Literal["ids-names.boddef"]
    name: str
    code: int


@dataclass(frozen=True)
class StepIdsNamesBodfnd:
    op: Literal["ids-names.bodfnd"]
    body: int
    item: str


@dataclass(frozen=True)
class StepIdsNamesBods2c:
    op: Literal["ids-names.bods2c"]
    name: str


@dataclass(frozen=True)
class StepIdsNamesBodvar:
    op: Literal["ids-names.bodvar"]
    body: int
    item: str
