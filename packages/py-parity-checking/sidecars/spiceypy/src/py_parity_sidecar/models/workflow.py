from __future__ import annotations

from typing import TypeAlias

from .cells_windows import (
    StepCellsWindowsCard,
    StepCellsWindowsAppndc,
    StepCellsWindowsAppndd,
    StepCellsWindowsAppndi,
    StepCellsWindowsSetResult,
    StepCellsWindowsSet,
    StepCellsWindowsRemovc,
    StepCellsWindowsRemovd,
    StepCellsWindowsRemovi,
    StepCellsWindowsOrdc,
    StepCellsWindowsOrdd,
    StepCellsWindowsOrdi,
    StepCellsWindowsCopy,
    StepCellsWindowsElemc,
    StepCellsWindowsElemd,
    StepCellsWindowsElemi,
    StepCellsWindowsLparss,
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
    StepCellsWindowsWncomd,
    StepCellsWindowsWncond,
    StepCellsWindowsWndifd,
    StepCellsWindowsWnelmd,
    StepCellsWindowsWnexpd,
    StepCellsWindowsWnextd,
    StepCellsWindowsWnfild,
    StepCellsWindowsWnfltd,
    StepCellsWindowsWnincd,
    StepCellsWindowsWnintd,
    StepCellsWindowsWnreld,
    StepCellsWindowsWnsumd,
    StepCellsWindowsWnunid,
    StepCellsWindowsWnvald,
)
from .coords_vectors import (
    StepCoordsVectorsAxisar,
    StepCoordsVectorsGeorec,
    StepCoordsVectorsLatrec,
    StepCoordsVectorsMtxv,
    StepCoordsVectorsMxm,
    StepCoordsVectorsMxv,
    StepCoordsVectorsCyllat,
    StepCoordsVectorsCylrec,
    StepCoordsVectorsCylsph,
    StepCoordsVectorsLatcyl,
    StepCoordsVectorsLatsph,
    StepCoordsVectorsReccyl,
    StepCoordsVectorsSphcyl,
    StepCoordsVectorsSphlat,
    StepCoordsVectorsVdist,
    StepCoordsVectorsVequ,
    StepCoordsVectorsVpack,
    StepCoordsVectorsVupack,
    StepCoordsVectorsVzero,
    StepCoordsVectorsUnorm,
    StepCoordsVectorsUcrss,
    StepCoordsVectorsVsep,
    StepCoordsVectorsVlcom,
    StepCoordsVectorsVlcom3,
    StepCoordsVectorsVperp,
    StepCoordsVectorsVproj,
    StepCoordsVectorsVrel,
    StepCoordsVectorsVrotv,
    StepCoordsVectorsRotvec,
    StepCoordsVectorsVtmv,
    StepCoordsVectorsAzlrec,
    StepCoordsVectorsRecazl,
    StepCoordsVectorsPgrrec,
    StepCoordsVectorsRecpgr,
    StepCoordsVectorsRadrec,
    StepCoordsVectorsRecrad,
    StepCoordsVectorsSrfrec,
    StepCoordsVectorsBrcktd,
    StepCoordsVectorsBrckti,
    StepCoordsVectorsConvrt,
    StepCoordsVectorsSumad,
    StepCoordsVectorsSumai,
    StepCoordsVectorsMaxd,
    StepCoordsVectorsMaxi,
    StepCoordsVectorsMind,
    StepCoordsVectorsMini,
    StepCoordsVectorsDucrss,
    StepCoordsVectorsDvcrss,
    StepCoordsVectorsDvdot,
    StepCoordsVectorsDvhat,
    StepCoordsVectorsDvnorm,
    StepCoordsVectorsDvsep,
    StepCoordsVectorsChbder,
    StepCoordsVectorsChbigr,
    StepCoordsVectorsChbint,
    StepCoordsVectorsChbval,
    StepCoordsVectorsPolyds,
    StepCoordsVectorsRquad,
    StepCoordsVectorsHrmesp,
    StepCoordsVectorsHrmint,
    StepCoordsVectorsLgresp,
    StepCoordsVectorsLgrind,
    StepCoordsVectorsLgrint,
    StepCoordsVectorsQderiv,
    StepCoordsVectorsClearc,
    StepCoordsVectorsCleard,
    StepCoordsVectorsCleari,
    StepCoordsVectorsFilld,
    StepCoordsVectorsFilli,
    StepCoordsVectorsMoved,
    StepCoordsVectorsEul2m,
    StepCoordsVectorsM2eul,
    StepCoordsVectorsM2q,
    StepCoordsVectorsQ2m,
    StepCoordsVectorsQxq,
    StepCoordsVectorsQdq2av,
    StepCoordsVectorsRaxisa,
    StepCoordsVectorsDet,
    StepCoordsVectorsDiags2,
    StepCoordsVectorsIdent,
    StepCoordsVectorsInvert,
    StepCoordsVectorsInvort,
    StepCoordsVectorsIsrot,
    StepCoordsVectorsMequ,
    StepCoordsVectorsMtxm,
    StepCoordsVectorsMxmt,
    StepCoordsVectorsTrace,
    StepCoordsVectorsXpose,
    StepCoordsVectorsMequg,
    StepCoordsVectorsMtxmg,
    StepCoordsVectorsMtxvg,
    StepCoordsVectorsMxmg,
    StepCoordsVectorsMxmtg,
    StepCoordsVectorsMxvg,
    StepCoordsVectorsVtmvg,
    StepCoordsVectorsXposeg,
    StepCoordsVectorsVaddg,
    StepCoordsVectorsVdistg,
    StepCoordsVectorsVdotg,
    StepCoordsVectorsVequg,
    StepCoordsVectorsVhatg,
    StepCoordsVectorsVlcomg,
    StepCoordsVectorsVminug,
    StepCoordsVectorsVnormg,
    StepCoordsVectorsVprojg,
    StepCoordsVectorsVrelg,
    StepCoordsVectorsVsclg,
    StepCoordsVectorsVsepg,
    StepCoordsVectorsVsubg,
    StepCoordsVectorsVzerog,
    StepCoordsVectorsUnormg,
    StepCoordsVectorsDazldr,
    StepCoordsVectorsDcyldr,
    StepCoordsVectorsDgeodr,
    StepCoordsVectorsDlatdr,
    StepCoordsVectorsDpgrdr,
    StepCoordsVectorsDrdazl,
    StepCoordsVectorsDrdcyl,
    StepCoordsVectorsDrdgeo,
    StepCoordsVectorsDrdlat,
    StepCoordsVectorsDrdpgr,
    StepCoordsVectorsDrdsph,
    StepCoordsVectorsDsphdr,
    StepCoordsVectorsIsordv,
    StepCoordsVectorsOrderc,
    StepCoordsVectorsOrderd,
    StepCoordsVectorsOrderi,
    StepCoordsVectorsReordc,
    StepCoordsVectorsReordd,
    StepCoordsVectorsReordi,
    StepCoordsVectorsReordl,
    StepCoordsVectorsShellc,
    StepCoordsVectorsShelld,
    StepCoordsVectorsShelli,
    StepCoordsVectorsLstlec,
    StepCoordsVectorsLstled,
    StepCoordsVectorsLstlei,
    StepCoordsVectorsLstltc,
    StepCoordsVectorsLstltd,
    StepCoordsVectorsLstlti,
    StepCoordsVectorsBschoc,
    StepCoordsVectorsBschoi,
    StepCoordsVectorsBsrchc,
    StepCoordsVectorsBsrchd,
    StepCoordsVectorsBsrchi,
    StepCoordsVectorsIsrchc,
    StepCoordsVectorsIsrchd,
    StepCoordsVectorsIsrchi,
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
    StepCoordsVectorsPi,
    StepCoordsVectorsTwopi,
    StepCoordsVectorsHalfpi,
    StepCoordsVectorsDpr,
    StepCoordsVectorsRpd,
    StepCoordsVectorsClight,
    StepCoordsVectorsDpmax,
    StepCoordsVectorsDpmin,
    StepCoordsVectorsIntmax,
    StepCoordsVectorsIntmin,
    StepCoordsVectorsVnorm,
    StepCoordsVectorsVscl,
    StepCoordsVectorsVsub,
)
from .ephemeris import (
    StepEphemerisSpkcls,
    StepEphemerisSpkcov,
    StepEphemerisSpkez,
    StepEphemerisSpkezp,
    StepEphemerisSpkezr,
    StepEphemerisSpkgeo,
    StepEphemerisSpkgps,
    StepEphemerisSpkobj,
    StepEphemerisSpkopa,
    StepEphemerisSpkopn,
    StepEphemerisSpkpds,
    StepEphemerisSpkpos,
    StepEphemerisSpksfs,
    StepEphemerisSpkssb,
    StepEphemerisSpkuds,
    StepEphemerisSpkw08,
)
from .dsk import (
    StepDskDascls,
    StepDskDasopr,
    StepDskDlabfs,
    StepDskDskb02,
    StepDskDskgd,
    StepDskDskmi2,
    StepDskDskobj,
    StepDskDskopn,
    StepDskDsksrf,
    StepDskDskw02,
)
from .ek import (
    StepEkEkaclc,
    StepEkEkacld,
    StepEkEkacli,
    StepEkEkcls,
    StepEkEkgc,
    StepEkEkgd,
    StepEkEkffld,
    StepEkEkfind,
    StepEkEkgi,
    StepEkEkifld,
    StepEkEknseg,
    StepEkEkntab,
    StepEkEkops,
    StepEkEkbseg,
    StepEkEkappr,
    StepEkEkinsr,
    StepEkEkdelr,
    StepEkEkacec,
    StepEkEkaced,
    StepEkEkacei,
    StepEkEkrcec,
    StepEkEkrced,
    StepEkEkrcei,
    StepEkEkucec,
    StepEkEkuced,
    StepEkEkucei,
    StepEkEkopn,
    StepEkEkopr,
    StepEkEkopw,
    StepEkEktnam,
)
from .file_io import (
    StepFileIoDafbfs,
    StepFileIoDafcls,
    StepFileIoDaffna,
    StepFileIoDafbbs,
    StepFileIoDafcs,
    StepFileIoDaffpa,
    StepFileIoDafgh,
    StepFileIoDafgn,
    StepFileIoDafgs,
    StepFileIoDafhsf,
    StepFileIoDafopw,
    StepFileIoDafac,
    StepFileIoDafdc,
    StepFileIoDafec,
    StepFileIoDafrs,
    StepFileIoDafps,
    StepFileIoDafus,
    StepFileIoDafgsr,
    StepFileIoDafrfr,
    StepFileIoDafrda,
    StepFileIoDafgda,
    StepFileIoDafopr,
    StepFileIoDasac,
    StepFileIoDasdc,
    StepFileIoDasec,
    StepFileIoDasadc,
    StepFileIoDasadd,
    StepFileIoDasadi,
    StepFileIoDasrdc,
    StepFileIoDasrdd,
    StepFileIoDasrdi,
    StepFileIoDasudc,
    StepFileIoDasudd,
    StepFileIoDasudi,
    StepFileIoDasonw,
    StepFileIoDasops,
    StepFileIoDasopw,
    StepFileIoDashfn,
    StepFileIoDashfs,
    StepFileIoDaslla,
    StepFileIoDasllc,
    StepFileIoDasrfr,
    StepFileIoDaswbr,
    StepFileIoDascls,
    StepFileIoDasopr,
    StepFileIoDlabbs,
    StepFileIoDlabns,
    StepFileIoDlaens,
    StepFileIoDlafps,
    StepFileIoDlabfs,
    StepFileIoDlacls,
    StepFileIoDlafns,
    StepFileIoDlaopn,
    StepFileIoDskmi2,
    StepFileIoDskopn,
    StepFileIoDskw02,
    StepFileIoExists,
    StepFileIoGetfat,
)
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
from .frames import (
    StepFramesCcifrm,
    StepFramesCidfrm,
    StepFramesCkcov,
    StepFramesCkgp,
    StepFramesCkgpav,
    StepFramesPckcls,
    StepFramesPckcov,
    StepFramesPckfrm,
    StepFramesPcklof,
    StepFramesPckopn,
    StepFramesPckuof,
    StepFramesPckw02,
    StepFramesCkopn,
    StepFramesCkcls,
    StepFramesCkw01,
    StepFramesCkw02,
    StepFramesCkw03,
    StepFramesCkw05,
    StepFramesCklpf,
    StepFramesCkobj,
    StepFramesCkupf,
    StepFramesCnmfrm,
    StepFramesFrinfo,
    StepFramesFrmnam,
    StepFramesNamfrm,
    StepFramesBltfrm,
    StepFramesPxfrm2,
    StepFramesTipbod,
    StepFramesTisbod,
    StepFramesTkfram,
    StepFramesXfmsta,
    StepFramesPxform,
    StepFramesFrame,
    StepFramesTwovec,
    StepFramesTwovxf,
    StepFramesEul2xf,
    StepFramesXf2eul,
    StepFramesXf2rav,
    StepFramesRav2xf,
    StepFramesInvstm,
    StepFramesXpose6,
    StepFramesSxform,
)
from .ids_names import (
    StepIdsNamesBodc2n,
    StepIdsNamesBodc2s,
    StepIdsNamesBoddef,
    StepIdsNamesBodfnd,
    StepIdsNamesSrfc2s,
    StepIdsNamesSrfcss,
    StepIdsNamesSrfs2c,
    StepIdsNamesSrfscc,
    StepIdsNamesBodn2c,
    StepIdsNamesBods2c,
    StepIdsNamesBodvar,
)
from .kernel_pool import (
    StepKernelPoolCvpool,
    StepKernelPoolDtpool,
    StepKernelPoolExpool,
    StepKernelPoolGcpool,
    StepKernelPoolBadkpv,
    StepKernelPoolBodvcd,
    StepKernelPoolBodvrd,
    StepKernelPoolClpool,
    StepKernelPoolDvpool,
    StepKernelPoolLdpool,
    StepKernelPoolLmpool,
    StepKernelPoolStpool,
    StepKernelPoolSzpool,
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
from .strings import (
    StepStringsCpos,
    StepStringsCposr,
    StepStringsNcpos,
    StepStringsNcposr,
    StepStringsPos,
    StepStringsPosr,
    StepStringsEsrchc,
    StepStringsDp2hx,
    StepStringsHx2dp,
    StepStringsPrsdp,
    StepStringsPrsint,
    StepStringsRepmc,
    StepStringsRepmct,
    StepStringsRepmd,
    StepStringsRepmf,
    StepStringsRepmi,
    StepStringsRepml,
    StepStringsRepmot,
    StepStringsNextwd,
    StepStringsNthwd,
    StepStringsLparse,
    StepStringsLparsm,
    StepStringsLx4dec,
    StepStringsLx4num,
    StepStringsLx4sgn,
    StepStringsLx4uns,
    StepStringsLxqstr,
    StepStringsCmprss,
    StepStringsEqstr,
    StepStringsIswhsp,
    StepStringsLastnb,
    StepStringsLcase,
    StepStringsUcase,
    StepStringsMatchi,
    StepStringsMatchw,
)
from .time import (
    StepTimeDeltet,
    StepTimeEt2Utc,
    StepTimeScdecd,
    StepTimeScencd,
    StepTimeSce2t,
    StepTimeScfmt,
    StepTimeScpart,
    StepTimeSctiks,
    StepTimeSce2c,
    StepTimeSce2s,
    StepTimeScs2e,
    StepTimeSct2e,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    StepTimeTimout,
    StepTimeSpd,
    StepTimeJ2000,
    StepTimeJ1900,
    StepTimeB1950,
    StepTimeB1900,
    StepTimeJ1950,
    StepTimeJ2100,
    StepTimeJyear,
    StepTimeTyear,
    StepTimeTkvrsn,
    StepTimeEtcal,
    StepTimeUtc2et,
    StepTimeTparch,
    StepTimeTsetyr,
    StepTimeEt2lst,
    StepTimeTparse,
    StepTimeTpictr,
    StepTimeUnitim,
)

WorkflowStep: TypeAlias = (
    StepTimeStr2Et
    | StepStringsCpos
    | StepStringsCposr
    | StepStringsNcpos
    | StepStringsNcposr
    | StepStringsPos
    | StepStringsPosr
    | StepStringsEsrchc
    | StepStringsDp2hx
    | StepStringsHx2dp
    | StepStringsPrsdp
    | StepStringsPrsint
    | StepStringsRepmc
    | StepStringsRepmct
    | StepStringsRepmd
    | StepStringsRepmf
    | StepStringsRepmi
    | StepStringsRepml
    | StepStringsRepmot
    | StepStringsNextwd
    | StepStringsNthwd
    | StepStringsLparse
    | StepStringsLparsm
    | StepStringsLx4dec
    | StepStringsLx4num
    | StepStringsLx4sgn
    | StepStringsLx4uns
    | StepStringsLxqstr
    | StepStringsCmprss
    | StepStringsEqstr
    | StepStringsIswhsp
    | StepStringsLastnb
    | StepStringsLcase
    | StepStringsUcase
    | StepStringsMatchi
    | StepStringsMatchw
    | StepTimeEt2Utc
    | StepTimeSpd
    | StepTimeJ2000
    | StepTimeJ1900
    | StepTimeB1950
    | StepTimeB1900
    | StepTimeJ1950
    | StepTimeJ2100
    | StepTimeJyear
    | StepTimeTyear
    | StepTimeTkvrsn
    | StepTimeTimout
    | StepTimeDeltet
    | StepTimeUnitim
    | StepTimeEtcal
    | StepTimeUtc2et
    | StepTimeTparch
    | StepTimeTsetyr
    | StepTimeEt2lst
    | StepTimeTparse
    | StepTimeTpictr
    | StepTimeTimdefGet
    | StepTimeTimdefSet
    | StepTimeScs2e
    | StepTimeSce2s
    | StepTimeScencd
    | StepTimeScdecd
    | StepTimeSct2e
    | StepTimeSce2t
    | StepTimeScfmt
    | StepTimeScpart
    | StepTimeSctiks
    | StepTimeSce2c
    | StepIdsNamesSrfc2s
    | StepIdsNamesSrfcss
    | StepIdsNamesSrfs2c
    | StepIdsNamesSrfscc
    | StepIdsNamesBodn2c
    | StepIdsNamesBodc2n
    | StepIdsNamesBodc2s
    | StepIdsNamesBoddef
    | StepIdsNamesBodfnd
    | StepIdsNamesBods2c
    | StepIdsNamesBodvar
    | StepCoordsVectorsCyllat
    | StepCoordsVectorsCylrec
    | StepCoordsVectorsCylsph
    | StepCoordsVectorsLatcyl
    | StepCoordsVectorsLatsph
    | StepCoordsVectorsReccyl
    | StepCoordsVectorsSphcyl
    | StepCoordsVectorsSphlat
    | StepCoordsVectorsVdist
    | StepCoordsVectorsVequ
    | StepCoordsVectorsVpack
    | StepCoordsVectorsVupack
    | StepCoordsVectorsVzero
    | StepCoordsVectorsUnorm
    | StepCoordsVectorsUcrss
    | StepCoordsVectorsVsep
    | StepCoordsVectorsVlcom
    | StepCoordsVectorsVlcom3
    | StepCoordsVectorsVperp
    | StepCoordsVectorsVproj
    | StepCoordsVectorsVrel
    | StepCoordsVectorsVrotv
    | StepCoordsVectorsRotvec
    | StepCoordsVectorsVtmv
    | StepCoordsVectorsAzlrec
    | StepCoordsVectorsRecazl
    | StepCoordsVectorsPgrrec
    | StepCoordsVectorsRecpgr
    | StepCoordsVectorsRadrec
    | StepCoordsVectorsRecrad
    | StepCoordsVectorsSrfrec
    | StepCoordsVectorsBrcktd
    | StepCoordsVectorsBrckti
    | StepCoordsVectorsConvrt
    | StepCoordsVectorsSumad
    | StepCoordsVectorsSumai
    | StepCoordsVectorsMaxd
    | StepCoordsVectorsMaxi
    | StepCoordsVectorsMind
    | StepCoordsVectorsMini
    | StepCoordsVectorsDucrss
    | StepCoordsVectorsDvcrss
    | StepCoordsVectorsDvdot
    | StepCoordsVectorsDvhat
    | StepCoordsVectorsDvnorm
    | StepCoordsVectorsDvsep
    | StepCoordsVectorsChbder
    | StepCoordsVectorsChbigr
    | StepCoordsVectorsChbint
    | StepCoordsVectorsChbval
    | StepCoordsVectorsPolyds
    | StepCoordsVectorsRquad
    | StepCoordsVectorsHrmesp
    | StepCoordsVectorsHrmint
    | StepCoordsVectorsLgresp
    | StepCoordsVectorsLgrind
    | StepCoordsVectorsLgrint
    | StepCoordsVectorsQderiv
    | StepCoordsVectorsClearc
    | StepCoordsVectorsCleard
    | StepCoordsVectorsCleari
    | StepCoordsVectorsFilld
    | StepCoordsVectorsFilli
    | StepCoordsVectorsMoved
    | StepCoordsVectorsEul2m
    | StepCoordsVectorsM2eul
    | StepCoordsVectorsM2q
    | StepCoordsVectorsQ2m
    | StepCoordsVectorsQxq
    | StepCoordsVectorsQdq2av
    | StepCoordsVectorsRaxisa
    | StepCoordsVectorsDet
    | StepCoordsVectorsDiags2
    | StepCoordsVectorsIdent
    | StepCoordsVectorsInvert
    | StepCoordsVectorsInvort
    | StepCoordsVectorsIsrot
    | StepCoordsVectorsMequ
    | StepCoordsVectorsMtxm
    | StepCoordsVectorsMxmt
    | StepCoordsVectorsTrace
    | StepCoordsVectorsXpose
    | StepCoordsVectorsMequg
    | StepCoordsVectorsMtxmg
    | StepCoordsVectorsMtxvg
    | StepCoordsVectorsMxmg
    | StepCoordsVectorsMxmtg
    | StepCoordsVectorsMxvg
    | StepCoordsVectorsVtmvg
    | StepCoordsVectorsXposeg
    | StepCoordsVectorsVaddg
    | StepCoordsVectorsVdistg
    | StepCoordsVectorsVdotg
    | StepCoordsVectorsVequg
    | StepCoordsVectorsVhatg
    | StepCoordsVectorsVlcomg
    | StepCoordsVectorsVminug
    | StepCoordsVectorsVnormg
    | StepCoordsVectorsVprojg
    | StepCoordsVectorsVrelg
    | StepCoordsVectorsVsclg
    | StepCoordsVectorsVsepg
    | StepCoordsVectorsVsubg
    | StepCoordsVectorsVzerog
    | StepCoordsVectorsUnormg
    | StepCoordsVectorsDazldr
    | StepCoordsVectorsDcyldr
    | StepCoordsVectorsDgeodr
    | StepCoordsVectorsDlatdr
    | StepCoordsVectorsDpgrdr
    | StepCoordsVectorsDrdazl
    | StepCoordsVectorsDrdcyl
    | StepCoordsVectorsDrdgeo
    | StepCoordsVectorsDrdlat
    | StepCoordsVectorsDrdpgr
    | StepCoordsVectorsDrdsph
    | StepCoordsVectorsDsphdr
    | StepCoordsVectorsIsordv
    | StepCoordsVectorsOrderc
    | StepCoordsVectorsOrderd
    | StepCoordsVectorsOrderi
    | StepCoordsVectorsReordc
    | StepCoordsVectorsReordd
    | StepCoordsVectorsReordi
    | StepCoordsVectorsReordl
    | StepCoordsVectorsShellc
    | StepCoordsVectorsShelld
    | StepCoordsVectorsShelli
    | StepCoordsVectorsLstlec
    | StepCoordsVectorsLstled
    | StepCoordsVectorsLstlei
    | StepCoordsVectorsLstltc
    | StepCoordsVectorsLstltd
    | StepCoordsVectorsLstlti
    | StepCoordsVectorsBschoc
    | StepCoordsVectorsBschoi
    | StepCoordsVectorsBsrchc
    | StepCoordsVectorsBsrchd
    | StepCoordsVectorsBsrchi
    | StepCoordsVectorsIsrchc
    | StepCoordsVectorsIsrchd
    | StepCoordsVectorsIsrchi
    | StepCoordsVectorsReclat
    | StepCoordsVectorsLatrec
    | StepCoordsVectorsRecsph
    | StepCoordsVectorsSphrec
    | StepCoordsVectorsPi
    | StepCoordsVectorsTwopi
    | StepCoordsVectorsHalfpi
    | StepCoordsVectorsDpr
    | StepCoordsVectorsRpd
    | StepCoordsVectorsClight
    | StepCoordsVectorsDpmax
    | StepCoordsVectorsDpmin
    | StepCoordsVectorsIntmax
    | StepCoordsVectorsIntmin
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
    | StepCellsWindowsAppndc
    | StepCellsWindowsAppndd
    | StepCellsWindowsAppndi
    | StepCellsWindowsSetResult
    | StepCellsWindowsSet
    | StepCellsWindowsRemovc
    | StepCellsWindowsRemovd
    | StepCellsWindowsRemovi
    | StepCellsWindowsOrdc
    | StepCellsWindowsOrdd
    | StepCellsWindowsOrdi
    | StepCellsWindowsCopy
    | StepCellsWindowsElemc
    | StepCellsWindowsElemd
    | StepCellsWindowsElemi
    | StepCellsWindowsLparss
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
    | StepCellsWindowsWncomd
    | StepCellsWindowsWncond
    | StepCellsWindowsWndifd
    | StepCellsWindowsWnelmd
    | StepCellsWindowsWnexpd
    | StepCellsWindowsWnextd
    | StepCellsWindowsWnfild
    | StepCellsWindowsWnfltd
    | StepCellsWindowsWnincd
    | StepCellsWindowsWnintd
    | StepCellsWindowsWnreld
    | StepCellsWindowsWnsumd
    | StepCellsWindowsWnunid
    | StepCellsWindowsWnvald
    | StepKernelPoolBadkpv
    | StepKernelPoolBodvcd
    | StepKernelPoolBodvrd
    | StepKernelPoolClpool
    | StepKernelPoolDvpool
    | StepKernelPoolLdpool
    | StepKernelPoolLmpool
    | StepKernelPoolStpool
    | StepKernelPoolSzpool
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
    | StepEphemerisSpkcls
    | StepEphemerisSpkcov
    | StepEphemerisSpkez
    | StepEphemerisSpkezp
    | StepEphemerisSpkezr
    | StepEphemerisSpkgeo
    | StepEphemerisSpkgps
    | StepEphemerisSpkobj
    | StepEphemerisSpkopa
    | StepEphemerisSpkopn
    | StepEphemerisSpkpds
    | StepEphemerisSpkpos
    | StepEphemerisSpksfs
    | StepEphemerisSpkssb
    | StepEphemerisSpkuds
    | StepEphemerisSpkw08
    | StepFileIoExists
    | StepFileIoGetfat
    | StepFileIoDafbbs
    | StepFileIoDafcs
    | StepFileIoDaffpa
    | StepFileIoDafgh
    | StepFileIoDafgn
    | StepFileIoDafgs
    | StepFileIoDafhsf
    | StepFileIoDafopw
    | StepFileIoDafac
    | StepFileIoDafdc
    | StepFileIoDafec
    | StepFileIoDafrs
    | StepFileIoDafps
    | StepFileIoDafus
    | StepFileIoDafgsr
    | StepFileIoDafrfr
    | StepFileIoDafrda
    | StepFileIoDafgda
    | StepFileIoDafopr
    | StepFileIoDafcls
    | StepFileIoDafbfs
    | StepFileIoDaffna
    | StepFileIoDasopr
    | StepFileIoDasac
    | StepFileIoDasdc
    | StepFileIoDasec
    | StepFileIoDasadc
    | StepFileIoDasadd
    | StepFileIoDasadi
    | StepFileIoDasrdc
    | StepFileIoDasrdd
    | StepFileIoDasrdi
    | StepFileIoDasudc
    | StepFileIoDasudd
    | StepFileIoDasudi
    | StepFileIoDasonw
    | StepFileIoDasops
    | StepFileIoDasopw
    | StepFileIoDashfn
    | StepFileIoDashfs
    | StepFileIoDaslla
    | StepFileIoDasllc
    | StepFileIoDasrfr
    | StepFileIoDaswbr
    | StepFileIoDascls
    | StepFileIoDlaopn
    | StepFileIoDlabbs
    | StepFileIoDlabns
    | StepFileIoDlaens
    | StepFileIoDlafps
    | StepFileIoDlabfs
    | StepFileIoDlafns
    | StepFileIoDlacls
    | StepFileIoDskopn
    | StepFileIoDskmi2
    | StepFileIoDskw02
    | StepErrorFailed
    | StepErrorReset
    | StepErrorGetmsg
    | StepErrorSetmsg
    | StepErrorSigerr
    | StepErrorChkin
    | StepErrorChkout
    | StepFramesNamfrm
    | StepFramesFrmnam
    | StepFramesCidfrm
    | StepFramesCnmfrm
    | StepFramesFrinfo
    | StepFramesCcifrm
    | StepFramesCkgp
    | StepFramesCkgpav
    | StepFramesPckcls
    | StepFramesPckcov
    | StepFramesPckfrm
    | StepFramesPcklof
    | StepFramesPckopn
    | StepFramesPckuof
    | StepFramesPckw02
    | StepFramesCkopn
    | StepFramesCkcls
    | StepFramesCkw01
    | StepFramesCkw02
    | StepFramesCkw03
    | StepFramesCkw05
    | StepFramesCklpf
    | StepFramesCkupf
    | StepFramesCkobj
    | StepFramesCkcov
    | StepFramesBltfrm
    | StepFramesPxfrm2
    | StepFramesTipbod
    | StepFramesTisbod
    | StepFramesTkfram
    | StepFramesXfmsta
    | StepFramesPxform
    | StepFramesFrame
    | StepFramesTwovec
    | StepFramesTwovxf
    | StepFramesEul2xf
    | StepFramesXf2eul
    | StepFramesXf2rav
    | StepFramesRav2xf
    | StepFramesInvstm
    | StepFramesXpose6
    | StepFramesSxform
    | StepEkEkops
    | StepEkEkbseg
    | StepEkEkappr
    | StepEkEkinsr
    | StepEkEkdelr
    | StepEkEkacec
    | StepEkEkaced
    | StepEkEkacei
    | StepEkEkrcec
    | StepEkEkrced
    | StepEkEkrcei
    | StepEkEkucec
    | StepEkEkuced
    | StepEkEkucei
    | StepEkEkopn
    | StepEkEkopr
    | StepEkEkopw
    | StepEkEkcls
    | StepEkEkntab
    | StepEkEktnam
    | StepEkEknseg
    | StepEkEkfind
    | StepEkEkgc
    | StepEkEkgd
    | StepEkEkgi
    | StepEkEkifld
    | StepEkEkacli
    | StepEkEkacld
    | StepEkEkaclc
    | StepEkEkffld
    | StepDskDskobj
    | StepDskDsksrf
    | StepDskDskopn
    | StepDskDskmi2
    | StepDskDskw02
    | StepDskDasopr
    | StepDskDascls
    | StepDskDlabfs
    | StepDskDskgd
    | StepDskDskb02
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
