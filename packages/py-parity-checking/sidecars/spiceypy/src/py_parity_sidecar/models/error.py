from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class StepErrorErrdev:
    op: Literal["error.errdev"]
    operation: str
    capacity: int | None = None
    value: str = ""


@dataclass(frozen=True)
class StepErrorErrprt:
    op: Literal["error.errprt"]
    operation: str
    capacity: int | None = None
    value: str = ""


@dataclass(frozen=True)
class StepErrorTrcoff:
    op: Literal["error.trcoff"]


@dataclass(frozen=True)
class StepErrorErrch:
    op: Literal["error.errch"]
    marker: str
    value: str


@dataclass(frozen=True)
class StepErrorErrdp:
    op: Literal["error.errdp"]
    marker: str
    value: float


@dataclass(frozen=True)
class StepErrorErrint:
    op: Literal["error.errint"]
    marker: str
    value: int


@dataclass(frozen=True)
class StepErrorQcktrc:
    op: Literal["error.qcktrc"]
    tracelen: int | None = None


@dataclass(frozen=True)
class StepErrorReturn:
    op: Literal["error.return"]


@dataclass(frozen=True)
class StepErrorTrcdep:
    op: Literal["error.trcdep"]


@dataclass(frozen=True)
class StepErrorTrcnam:
    op: Literal["error.trcnam"]
    index: int
    namlen: int | None = None


@dataclass(frozen=True)
class StepErrorFailed:
    op: Literal["error.failed"]


@dataclass(frozen=True)
class StepErrorReset:
    op: Literal["error.reset"]


@dataclass(frozen=True)
class StepErrorGetmsg:
    op: Literal["error.getmsg"]
    which: str


@dataclass(frozen=True)
class StepErrorSetmsg:
    op: Literal["error.setmsg"]
    message: str


@dataclass(frozen=True)
class StepErrorSigerr:
    op: Literal["error.sigerr"]
    short: str
    capture: bool = False


@dataclass(frozen=True)
class StepErrorChkin:
    op: Literal["error.chkin"]
    name: str


@dataclass(frozen=True)
class StepErrorChkout:
    op: Literal["error.chkout"]
    name: str
