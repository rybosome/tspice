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
from .geometry_gf import (
    StepGeometryGfGfdist,
    StepGeometryGfGfrefn,
    StepGeometryGfGfrepf,
    StepGeometryGfGfrepi,
    StepGeometryGfGfsep,
    StepGeometryGfGfsstp,
    StepGeometryGfGfstep,
    StepGeometryGfGfstol,
)
from .ids_names import (
    StepIdsNamesBodc2n,
    StepIdsNamesBodc2s,
    StepIdsNamesBoddef,
    StepIdsNamesBodfnd,
    StepIdsNamesBodn2c,
    StepIdsNamesBods2c,
    StepIdsNamesBodvar,
)
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
from .kernels import (
    StepKernelsFurnsh,
    StepKernelsKclear,
    StepKernelsKdata,
    StepKernelsKinfo,
    StepKernelsKplfrm,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepKernelsUnload,
)
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
    | StepIdsNamesBodc2n
    | StepIdsNamesBodc2s
    | StepIdsNamesBoddef
    | StepIdsNamesBodfnd
    | StepIdsNamesBods2c
    | StepIdsNamesBodvar
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
    | StepKernelsKclear
    | StepKernelsKinfo
    | StepKernelsKplfrm
    | StepKernelsKtotal
    | StepKernelsKdata
    | StepKernelsKxtrct
    | StepKernelsUnload
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
    | StepGeometryGfGfsstp
    | StepGeometryGfGfstep
    | StepGeometryGfGfstol
    | StepGeometryGfGfrefn
    | StepGeometryGfGfrepi
    | StepGeometryGfGfrepf
    | StepGeometryGfGfsep
    | StepGeometryGfGfdist
)
