from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepStringsNextwd:
    op: Literal["strings.nextwd"]
    input: str
    nexlen: int | None = None
    reslen: int | None = None


@dataclass(frozen=True)
class StepStringsNthwd:
    op: Literal["strings.nthwd"]
    input: str
    nth: int
    worlen: int | None = None


@dataclass(frozen=True)
class StepStringsLparse:
    op: Literal["strings.lparse"]
    list: str
    delim: str
    nmax: int
    itemln: int | None = None


@dataclass(frozen=True)
class StepStringsLparsm:
    op: Literal["strings.lparsm"]
    list: str
    delims: str
    nmax: int
    itemln: int | None = None


@dataclass(frozen=True)
class StepStringsLx4dec:
    op: Literal["strings.lx4dec"]
    input: str
    first: int


@dataclass(frozen=True)
class StepStringsLx4num:
    op: Literal["strings.lx4num"]
    input: str
    first: int


@dataclass(frozen=True)
class StepStringsLx4sgn:
    op: Literal["strings.lx4sgn"]
    input: str
    first: int


@dataclass(frozen=True)
class StepStringsLx4uns:
    op: Literal["strings.lx4uns"]
    input: str
    first: int


@dataclass(frozen=True)
class StepStringsLxqstr:
    op: Literal["strings.lxqstr"]
    input: str
    qchar: str
    first: int


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
