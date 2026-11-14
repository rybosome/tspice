from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepStringsCmprss:
    op: Literal["strings.cmprss"]
    delim: str
    n: int
    input: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsEqstr:
    op: Literal["strings.eqstr"]
    a: str
    b: str


@dataclass(frozen=True)
class StepStringsIswhsp:
    op: Literal["strings.iswhsp"]
    input: str


@dataclass(frozen=True)
class StepStringsLastnb:
    op: Literal["strings.lastnb"]
    input: str


@dataclass(frozen=True)
class StepStringsLcase:
    op: Literal["strings.lcase"]
    input: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsUcase:
    op: Literal["strings.ucase"]
    input: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsMatchi:
    op: Literal["strings.matchi"]
    input: str
    template: str
    wstr: str
    wchr: str


@dataclass(frozen=True)
class StepStringsMatchw:
    op: Literal["strings.matchw"]
    input: str
    template: str
    wstr: str
    wchr: str
