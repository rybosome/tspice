from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepStringsCpos:
    op: Literal["strings.cpos"]
    text: str
    chars: str
    start: int


@dataclass(frozen=True)
class StepStringsCposr:
    op: Literal["strings.cposr"]
    text: str
    chars: str
    start: int


@dataclass(frozen=True)
class StepStringsNcpos:
    op: Literal["strings.ncpos"]
    text: str
    chars: str
    start: int


@dataclass(frozen=True)
class StepStringsNcposr:
    op: Literal["strings.ncposr"]
    text: str
    chars: str
    start: int


@dataclass(frozen=True)
class StepStringsPos:
    op: Literal["strings.pos"]
    text: str
    substr: str
    start: int


@dataclass(frozen=True)
class StepStringsPosr:
    op: Literal["strings.posr"]
    text: str
    substr: str
    start: int


@dataclass(frozen=True)
class StepStringsEsrchc:
    op: Literal["strings.esrchc"]
    value: str
    values: list[str]


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


@dataclass(frozen=True)
class StepStringsDp2hx:
    op: Literal["strings.dp2hx"]
    value: float
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsHx2dp:
    op: Literal["strings.hx2dp"]
    input: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsPrsdp:
    op: Literal["strings.prsdp"]
    input: str


@dataclass(frozen=True)
class StepStringsPrsint:
    op: Literal["strings.prsint"]
    input: str


@dataclass(frozen=True)
class StepStringsRepmc:
    op: Literal["strings.repmc"]
    input: str
    marker: str
    value: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepmct:
    op: Literal["strings.repmct"]
    input: str
    marker: str
    value: int
    rtcase: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepmd:
    op: Literal["strings.repmd"]
    input: str
    marker: str
    value: float
    sigdig: int
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepmf:
    op: Literal["strings.repmf"]
    input: str
    marker: str
    value: float
    sigdig: int
    format: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepmi:
    op: Literal["strings.repmi"]
    input: str
    marker: str
    value: int
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepml:
    op: Literal["strings.repml"]
    input: str
    marker: str
    value: bool
    rtcase: str
    lenout: int | None = None


@dataclass(frozen=True)
class StepStringsRepmot:
    op: Literal["strings.repmot"]
    input: str
    marker: str
    value: int
    rtcase: str
    lenout: int | None = None
