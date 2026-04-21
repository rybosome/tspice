from __future__ import annotations

from typing import TypeAlias

from .cells_windows import StepCellsWindowsWnfetd, StepCellsWindowsWninsd
from .coords_vectors import StepCoordsVectorsMxm, StepCoordsVectorsRecgeo
from .ek import StepEkEkgc, StepEkEkfind
from .ids_names import StepIdsNamesBodn2c
from .kernel_pool import StepKernelPoolGcpool
from .kernels import StepKernelsFurnsh, StepKernelsKdata, StepKernelsKtotal, StepKernelsKxtrct
from .time import StepTimeEt2Utc, StepTimeStr2Et, StepTimeTimdefGet, StepTimeTimdefSet

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
