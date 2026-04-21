from __future__ import annotations

from typing import TypeAlias

from .cells_windows import StepCellsWindowsWnfetd, StepCellsWindowsWninsd
from .coords_vectors import StepCoordsVectorsMxm, StepCoordsVectorsRecgeo
from .ek import StepEkEkgc, StepEkEkfind
from .ids_names import StepIdsNamesBodn2c
from .kernel_pool import (
    StepKernelPoolCvpool,
    StepKernelPoolDtpool,
    StepKernelPoolExpool,
    StepKernelPoolGcpool,
    StepKernelPoolGdpool,
    StepKernelPoolGipool,
    StepKernelPoolGnpool,
    StepKernelPoolPcpool,
    StepKernelPoolPdpool,
    StepKernelPoolPipool,
    StepKernelPoolSwpool,
)
from .kernels import StepKernelsFurnsh, StepKernelsKdata, StepKernelsKtotal, StepKernelsKxtrct
from .time import (
    StepTimeDeltet,
    StepTimeEt2Utc,
    StepTimeScdecd,
    StepTimeScencd,
    StepTimeSce2c,
    StepTimeSce2s,
    StepTimeScs2e,
    StepTimeSct2e,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    StepTimeTimout,
    StepTimeTkvrsn,
    StepTimeTparse,
    StepTimeTpictr,
    StepTimeUnitim,
)

WorkflowStep: TypeAlias = (
    StepTimeStr2Et
    | StepTimeEt2Utc
    | StepTimeTkvrsn
    | StepTimeTimout
    | StepTimeDeltet
    | StepTimeUnitim
    | StepTimeTparse
    | StepTimeTpictr
    | StepTimeTimdefGet
    | StepTimeTimdefSet
    | StepTimeScs2e
    | StepTimeSce2s
    | StepTimeScencd
    | StepTimeScdecd
    | StepTimeSct2e
    | StepTimeSce2c
    | StepIdsNamesBodn2c
    | StepCoordsVectorsMxm
    | StepCoordsVectorsRecgeo
    | StepCellsWindowsWninsd
    | StepCellsWindowsWnfetd
    | StepKernelPoolGdpool
    | StepKernelPoolGipool
    | StepKernelPoolGcpool
    | StepKernelPoolGnpool
    | StepKernelPoolDtpool
    | StepKernelPoolPdpool
    | StepKernelPoolPipool
    | StepKernelPoolPcpool
    | StepKernelPoolSwpool
    | StepKernelPoolCvpool
    | StepKernelPoolExpool
    | StepKernelsFurnsh
    | StepKernelsKtotal
    | StepKernelsKdata
    | StepKernelsKxtrct
    | StepEkEkfind
    | StepEkEkgc
)
