from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

from .paths import RuntimeConfig
from .workflow import WorkflowStep

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]


@dataclass(frozen=True)
class CaseRequest:
    caseId: str
    workflow: list[WorkflowStep]
    runtime: RuntimeConfig | None = None


@dataclass(frozen=True)
class StepOutput:
    op: str
    value: JsonValue


@dataclass(frozen=True)
class CaseError:
    type: str
    message: str


@dataclass(frozen=True)
class CaseResponse:
    caseId: str
    ok: bool
    outputs: list[StepOutput]
    error: CaseError | None
