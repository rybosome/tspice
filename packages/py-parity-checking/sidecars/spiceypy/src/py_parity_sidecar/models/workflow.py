from __future__ import annotations

from typing import TypeAlias

from .cells_windows import (
    StepCellsWindowsCard,
    StepCellsWindowsInsrtc,
    StepCellsWindowsInsrtd,
    StepCellsWindowsInsrti,
    StepCellsWindowsScard,
    StepCellsWindowsSize,
    StepCellsWindowsSsize,
    StepCellsWindowsValid,
    StepCellsWindowsWncard,
    StepCellsWindowsWnfetd,
    StepCellsWindowsWninsd,
    StepCellsWindowsWnvald,
)
from .coords_vectors import (
    StepCoordsVectorsAxisar,
    StepCoordsVectorsGeorec,
    StepCoordsVectorsLatrec,
    StepCoordsVectorsMtxv,
    StepCoordsVectorsMxm,
    StepCoordsVectorsMxv,
    StepCoordsVectorsReclat,
    StepCoordsVectorsRecgeo,
    StepCoordsVectorsRecsph,
    StepCoordsVectorsRotate,
    StepCoordsVectorsRotmat,
    StepCoordsVectorsSphrec,
    StepCoordsVectorsVadd,
    StepCoordsVectorsVcrss,
    StepCoordsVectorsVdot,
    StepCoordsVectorsVhat,
    StepCoordsVectorsVminus,
    StepCoordsVectorsVnorm,
    StepCoordsVectorsVscl,
    StepCoordsVectorsVsub,
)
from .ek import StepEkEkgc, StepEkEkfind
from .error import (
    StepErrorChkin,
    StepErrorChkout,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
)
from .geometry import (
    StepGeometryIlumin,
    StepGeometryIllumf,
    StepGeometryIllumg,
    StepGeometryNvc2pl,
    StepGeometryOccult,
    StepGeometryPl2nvc,
    StepGeometrySincpt,
    StepGeometrySubpnt,
    StepGeometrySubslr,
)
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
    | StepCoordsVectorsReclat
    | StepCoordsVectorsLatrec
    | StepCoordsVectorsRecsph
    | StepCoordsVectorsSphrec
    | StepCoordsVectorsVnorm
    | StepCoordsVectorsVhat
    | StepCoordsVectorsVdot
    | StepCoordsVectorsVcrss
    | StepCoordsVectorsVadd
    | StepCoordsVectorsVsub
    | StepCoordsVectorsVminus
    | StepCoordsVectorsVscl
    | StepCoordsVectorsMxm
    | StepCoordsVectorsRotate
    | StepCoordsVectorsRotmat
    | StepCoordsVectorsAxisar
    | StepCoordsVectorsGeorec
    | StepCoordsVectorsRecgeo
    | StepCoordsVectorsMxv
    | StepCoordsVectorsMtxv
    | StepCellsWindowsCard
    | StepCellsWindowsInsrtc
    | StepCellsWindowsInsrtd
    | StepCellsWindowsInsrti
    | StepCellsWindowsScard
    | StepCellsWindowsSize
    | StepCellsWindowsSsize
    | StepCellsWindowsValid
    | StepCellsWindowsWncard
    | StepCellsWindowsWninsd
    | StepCellsWindowsWnfetd
    | StepCellsWindowsWnvald
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
    | StepErrorFailed
    | StepErrorReset
    | StepErrorGetmsg
    | StepErrorSetmsg
    | StepErrorSigerr
    | StepErrorChkin
    | StepErrorChkout
    | StepEkEkfind
    | StepEkEkgc
    | StepGeometrySubpnt
    | StepGeometrySubslr
    | StepGeometrySincpt
    | StepGeometryIlumin
    | StepGeometryIllumg
    | StepGeometryIllumf
    | StepGeometryOccult
    | StepGeometryNvc2pl
    | StepGeometryPl2nvc
)
