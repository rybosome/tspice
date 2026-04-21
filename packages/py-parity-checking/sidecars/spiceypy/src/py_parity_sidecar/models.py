from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

TimdefItem: TypeAlias = Literal["SYSTEM", "CALENDAR", "ZONE"]

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]


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


@dataclass(frozen=True)
class StepIdsNamesBodn2c:
    op: Literal["ids-names.bodn2c"]
    name: str


@dataclass(frozen=True)
class StepCoordsVectorsMxm:
    op: Literal["coords-vectors.mxm"]
    m1: list[list[float]]
    m2: list[list[float]]


@dataclass(frozen=True)
class StepCoordsVectorsRecgeo:
    op: Literal["coords-vectors.recgeo"]
    rectan: tuple[float, float, float]
    re: float
    f: float


@dataclass(frozen=True)
class StepCellsWindowsWninsd:
    op: Literal["cells-windows.wninsd"]
    windowId: str
    left: float
    right: float
    maxIntervals: int | None = None


@dataclass(frozen=True)
class StepCellsWindowsWnfetd:
    op: Literal["cells-windows.wnfetd"]
    windowId: str
    index: int


@dataclass(frozen=True)
class StepKernelPoolGcpool:
    op: Literal["kernel-pool.gcpool"]
    name: str
    start: int
    room: int


@dataclass(frozen=True)
class StepKernelsFurnsh:
    op: Literal["kernels.furnsh"]
    file: str


@dataclass(frozen=True)
class StepKernelsKtotal:
    op: Literal["kernels.ktotal"]
    kind: str


@dataclass(frozen=True)
class StepKernelsKdata:
    op: Literal["kernels.kdata"]
    which: int
    kind: str


@dataclass(frozen=True)
class StepKernelsKxtrct:
    op: Literal["kernels.kxtrct"]
    keywd: str
    terms: list[str]
    string: str


@dataclass(frozen=True)
class StepEkEkfind:
    op: Literal["ek.ekfind"]
    query: str


@dataclass(frozen=True)
class StepEkEkgc:
    op: Literal["ek.ekgc"]
    selidx: int
    row: int
    elment: int


WorkflowStep: TypeAlias = (
    StepTimeStr2Et
    | StepTimeEt2Utc
    | StepTimeTimdefGet
    | StepTimeTimdefSet
    | StepIdsNamesBodn2c
    | StepCoordsVectorsMxm
    | StepCoordsVectorsRecgeo
    | StepCellsWindowsWninsd
    | StepCellsWindowsWnfetd
    | StepKernelPoolGcpool
    | StepKernelsFurnsh
    | StepKernelsKtotal
    | StepKernelsKdata
    | StepKernelsKxtrct
    | StepEkEkfind
    | StepEkEkgc
)


@dataclass(frozen=True)
class CaseRequest:
    caseId: str
    workflow: list[WorkflowStep]


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
