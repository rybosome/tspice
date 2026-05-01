from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


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


@dataclass(frozen=True)
class StepErrorChkin:
    op: Literal["error.chkin"]
    name: str


@dataclass(frozen=True)
class StepErrorChkout:
    op: Literal["error.chkout"]
    name: str
