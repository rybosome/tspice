from __future__ import annotations

import math
from typing import Any, Mapping

from .models import (
    CaseRequest,
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
    StepEphemerisSpkcls,
    StepEphemerisSpkcov,
    StepEphemerisSpkez,
    StepEphemerisSpkezp,
    StepEphemerisSpkezr,
    StepEphemerisConics,
    StepEphemerisEqncpv,
    StepEphemerisOscelt,
    StepEphemerisOscltx,
    StepEphemerisProp2b,
    StepEphemerisGetelm,
    StepEphemerisEvsgp4,
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
    StepEphemerisSpkw02,
    StepEphemerisSpkw03,
    StepEphemerisSpkw20,
    StepEphemerisSpkw09,
    StepEphemerisSpkw12,
    StepEphemerisSpkw13,
    StepEphemerisSpkw18,
    StepEphemerisSpkw05,
    StepEphemerisSpkw10,
    StepEphemerisSpkw15,
    StepEphemerisSpkw17,
    StepEphemerisSpk14b,
    StepEphemerisSpk14a,
    StepEphemerisSpk14e,
    StepEphemerisSpkw08,
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
    StepEkEkccnt,
    StepEkEkcii,
    StepEkEklef,
    StepEkEknelt,
    StepEkEkpsel,
    StepEkEkssum,
    StepEkEkuef,
    StepEkEkopn,
    StepEkEkopr,
    StepEkEkopw,
    StepEkEktnam,
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
    StepFileIoRdtext,
    StepFileIoPutcml,
    StepFileIoExists,
    StepFileIoGetfat,
    StepErrorChkin,
    StepErrorChkout,
    StepErrorErrdev,
    StepErrorErrprt,
    StepErrorTrcoff,
    StepErrorErrch,
    StepErrorErrdp,
    StepErrorErrint,
    StepErrorQcktrc,
    StepErrorReturn,
    StepErrorTrcdep,
    StepErrorTrcnam,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
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
    StepFramesCkfrot,
    StepFramesCkfxfm,
    StepFramesCkgr02,
    StepFramesCkgr03,
    StepFramesCkmeta,
    StepFramesCknr02,
    StepFramesCknr03,
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
    StepGeometryIlumin,
    StepGeometryIllumf,
    StepGeometryIllumg,
    StepGeometryNvc2pl,
    StepGeometryOccult,
    StepGeometryPl2nvc,
    StepGeometrySincpt,
    StepGeometrySubpnt,
    StepGeometrySubslr,
    StepGeometryGfGfdist,
    StepGeometryGfGfrefn,
    StepGeometryGfGfrepf,
    StepGeometryGfGfrepi,
    StepGeometryGfGfsep,
    StepGeometryGfGfsstp,
    StepGeometryGfGfstep,
    StepGeometryGfGfstol,
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
    PathRef,
    RuntimeConfig,
    RuntimePaths,
    StepKernelsFurnsh,
    StepKernelsKclear,
    StepKernelsKdata,
    StepKernelsKinfo,
    StepKernelsKplfrm,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepKernelsUnload,
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
    StepTimeStr2Et,
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
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    StepTimeUnitim,
    WorkflowStep,
)


def _expect_mapping(value: Any, *, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"{label} must be an object")
    return value


def _expect_string(value: Any, *, label: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{label} must be a string")
    return value


def _expect_int(value: Any, *, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{label} must be an integer")
    return value


def _expect_number(value: Any, *, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be numeric")
    return float(value)


def _orbital_number(value: Any, *, label: str) -> float:
    result = _expect_number(value, label=label)
    if not math.isfinite(result):
        raise ValueError(f"{label} must be finite")
    return result


def _orbital_vector(value: Any, *, length: int, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != length:
        raise ValueError(f"{label} must contain exactly {length} components")
    return [_orbital_number(item, label=f"{label}[{index}]") for index, item in enumerate(value)]


def _expect_bool(value: Any, *, label: str) -> bool:
    if not isinstance(value, bool):
        raise TypeError(f"{label} must be a boolean")
    return value


def _expect_string_list(value: Any, *, label: str) -> list[str]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")
    out: list[str] = []
    for idx, item in enumerate(value):
        out.append(_expect_string(item, label=f"{label}[{idx}]"))
    return out


def _expect_daf_bytes(value: Any, *, label: str) -> list[int]:
    data = _expect_int_list(value, label=label)
    if any(byte < 0 or byte > 255 for byte in data):
        raise ValueError(f"{label} must contain unsigned bytes")
    return data


def _expect_int_list(value: Any, *, label: str) -> list[int]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")
    out: list[int] = []
    for idx, item in enumerate(value):
        out.append(_expect_int(item, label=f"{label}[{idx}]"))
    return out


def _expect_optional_string(value: Any, *, label: str) -> str | None:
    if value is None:
        return None
    return _expect_string(value, label=label)


def _expect_number_list(value: Any, *, label: str) -> list[float]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")
    out: list[float] = []
    for idx, item in enumerate(value):
        out.append(_expect_number(item, label=f"{label}[{idx}]"))
    return out


def _expect_bool_list(value: Any, *, label: str) -> list[bool]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")
    out: list[bool] = []
    for idx, item in enumerate(value):
        out.append(_expect_bool(item, label=f"{label}[{idx}]"))
    return out


def _expect_3x3_matrix(value: Any, *, label: str) -> list[list[float]]:
    if not isinstance(value, list) or len(value) != 3:
        raise TypeError(f"{label} must be a 3x3 number matrix")
    rows: list[list[float]] = []
    for row_idx, row in enumerate(value):
        if not isinstance(row, list) or len(row) != 3:
            raise TypeError(f"{label}[{row_idx}] must be length 3")
        rows.append([
            _expect_number(row[0], label=f"{label}[{row_idx}][0]"),
            _expect_number(row[1], label=f"{label}[{row_idx}][1]"),
            _expect_number(row[2], label=f"{label}[{row_idx}][2]"),
        ])
    return rows


def _expect_vec6(value: Any, *, label: str) -> tuple[float, float, float, float, float, float]:
    if not isinstance(value, list) or len(value) != 6:
        raise TypeError(f"{label} must be a length-6 number array")
    values = [_expect_number(item, label=f"{label}[{index}]") for index, item in enumerate(value)]
    if not all(math.isfinite(item) for item in values):
        raise ValueError(f"{label} must contain finite components")
    return (values[0], values[1], values[2], values[3], values[4], values[5])


def _expect_vec2(value: Any, *, label: str) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise TypeError(f"{label} must be a length-2 number array")
    return (_expect_number(value[0], label=f"{label}[0]"), _expect_number(value[1], label=f"{label}[1]"))


def _frame_words(value: Any, length: int, *, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != length:
        raise TypeError(f"{label} must contain {length} values")
    return _expect_number_list(value, label=label)


def _frame_matrix(value: Any, *, label: str) -> list[list[float]]:
    words = _frame_words(value, 36, label=label)
    return [words[start:start + 6] for start in range(0, 36, 6)]


def _expect_vec3(value: Any, *, label: str) -> tuple[float, float, float]:
    if not isinstance(value, list) or len(value) != 3:
        raise TypeError(f"{label} must be a length-3 number array")
    return (
        _expect_number(value[0], label=f"{label}[0]"),
        _expect_number(value[1], label=f"{label}[1]"),
        _expect_number(value[2], label=f"{label}[2]"),
    )


def _expect_vec4(value: Any, *, label: str) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:
        raise TypeError(f"{label} must be a length-4 number array")
    return (
        _expect_number(value[0], label=f"{label}[0]"),
        _expect_number(value[1], label=f"{label}[1]"),
        _expect_number(value[2], label=f"{label}[2]"),
        _expect_number(value[3], label=f"{label}[3]"),
    )


def _expect_vec3_rows(value: Any, *, label: str) -> list[tuple[float, float, float]]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")
    out: list[tuple[float, float, float]] = []
    for idx, row in enumerate(value):
        out.append(_expect_vec3(row, label=f"{label}[{idx}]"))
    return out


def _expect_index_triples(value: Any, *, label: str) -> list[tuple[int, int, int]]:
    if not isinstance(value, list):
        raise TypeError(f"{label} must be a list")

    out: list[tuple[int, int, int]] = []
    for idx, row in enumerate(value):
        if not isinstance(row, list) or len(row) != 3:
            raise TypeError(f"{label}[{idx}] must be a length-3 integer array")
        out.append(
            (
                _expect_int(row[0], label=f"{label}[{idx}][0]"),
                _expect_int(row[1], label=f"{label}[{idx}][1]"),
                _expect_int(row[2], label=f"{label}[{idx}][2]"),
            )
        )
    return out


def _decode_path_ref(value: Any, *, label: str) -> PathRef | str:
    if isinstance(value, str):
        return value

    raw = _expect_mapping(value, label=label)
    kind = _expect_string(raw.get("kind"), label=f"{label}.kind")
    if kind not in {"fixture", "scratch"}:
        raise ValueError(f"{label}.kind must be fixture|scratch")

    rel = _expect_string(raw.get("rel"), label=f"{label}.rel")
    return PathRef(kind=kind, rel=rel)


def _decode_runtime_config(value: Any) -> RuntimeConfig | None:
    if value is None:
        return None

    runtime = _expect_mapping(value, label="request.runtime")
    paths = _expect_mapping(runtime.get("paths"), label="request.runtime.paths")
    return RuntimeConfig(
        paths=RuntimePaths(
            fixturesRoot=_expect_string(paths.get("fixturesRoot"), label="request.runtime.paths.fixturesRoot"),
            scratchRoot=_expect_string(paths.get("scratchRoot"), label="request.runtime.paths.scratchRoot"),
        )
    )



def _expect_spk_packed_descriptor(value: Any, *, label: str) -> tuple[float, float, float, float, float]:
    numbers = _expect_number_list(value, label=label)
    if len(numbers) != 5:
        raise TypeError(f"{label} must be a length-5 number array")
    return (numbers[0], numbers[1], numbers[2], numbers[3], numbers[4])

def _decode_step(raw_step: Any) -> WorkflowStep:
    step = _expect_mapping(raw_step, label="workflow step")
    op = _expect_string(step.get("op"), label="workflow step.op")

    match op:
        case "strings.cpos":
            return StepStringsCpos(
                op=op,
                text=_expect_string(step.get("text"), label="strings.cpos.text"),
                chars=_expect_string(step.get("chars"), label="strings.cpos.chars"),
                start=_expect_int(step.get("start"), label="strings.cpos.start"),
            )

        case "strings.cposr":
            return StepStringsCposr(
                op=op,
                text=_expect_string(step.get("text"), label="strings.cposr.text"),
                chars=_expect_string(step.get("chars"), label="strings.cposr.chars"),
                start=_expect_int(step.get("start"), label="strings.cposr.start"),
            )

        case "strings.ncpos":
            return StepStringsNcpos(
                op=op,
                text=_expect_string(step.get("text"), label="strings.ncpos.text"),
                chars=_expect_string(step.get("chars"), label="strings.ncpos.chars"),
                start=_expect_int(step.get("start"), label="strings.ncpos.start"),
            )

        case "strings.ncposr":
            return StepStringsNcposr(
                op=op,
                text=_expect_string(step.get("text"), label="strings.ncposr.text"),
                chars=_expect_string(step.get("chars"), label="strings.ncposr.chars"),
                start=_expect_int(step.get("start"), label="strings.ncposr.start"),
            )

        case "strings.pos":
            return StepStringsPos(
                op=op,
                text=_expect_string(step.get("text"), label="strings.pos.text"),
                substr=_expect_string(step.get("substr"), label="strings.pos.substr"),
                start=_expect_int(step.get("start"), label="strings.pos.start"),
            )

        case "strings.posr":
            return StepStringsPosr(
                op=op,
                text=_expect_string(step.get("text"), label="strings.posr.text"),
                substr=_expect_string(step.get("substr"), label="strings.posr.substr"),
                start=_expect_int(step.get("start"), label="strings.posr.start"),
            )

        case "strings.esrchc":
            return StepStringsEsrchc(
                op=op,
                value=_expect_string(step.get("value"), label="strings.esrchc.value"),
                values=_expect_string_list(step.get("values"), label="strings.esrchc.values"),
            )

        case "strings.dp2hx":
            return StepStringsDp2hx(
                op=op,
                value=_expect_number(step.get("value"), label="strings.dp2hx.value"),
                lenout=_expect_int(step.get("lenout"), label="strings.dp2hx.lenout") if "lenout" in step else None,
            )
        case "strings.hx2dp":
            return StepStringsHx2dp(
                op=op,
                input=_expect_string(step.get("input"), label="strings.hx2dp.input"),
                lenout=_expect_int(step.get("lenout"), label="strings.hx2dp.lenout") if "lenout" in step else None,
            )
        case "strings.prsdp":
            return StepStringsPrsdp(
                op=op,
                input=_expect_string(step.get("input"), label="strings.prsdp.input"),
            )
        case "strings.prsint":
            return StepStringsPrsint(
                op=op,
                input=_expect_string(step.get("input"), label="strings.prsint.input"),
            )
        case "strings.repmc":
            return StepStringsRepmc(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmc.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmc.marker"),
                value=_expect_string(step.get("value"), label="strings.repmc.value"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmc.lenout") if "lenout" in step else None,
            )
        case "strings.repmct":
            return StepStringsRepmct(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmct.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmct.marker"),
                value=_expect_int(step.get("value"), label="strings.repmct.value"),
                rtcase=_expect_string(step.get("rtcase"), label="strings.repmct.rtcase"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmct.lenout") if "lenout" in step else None,
            )
        case "strings.repmd":
            return StepStringsRepmd(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmd.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmd.marker"),
                value=_expect_number(step.get("value"), label="strings.repmd.value"),
                sigdig=_expect_int(step.get("sigdig"), label="strings.repmd.sigdig"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmd.lenout") if "lenout" in step else None,
            )
        case "strings.repmf":
            return StepStringsRepmf(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmf.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmf.marker"),
                value=_expect_number(step.get("value"), label="strings.repmf.value"),
                sigdig=_expect_int(step.get("sigdig"), label="strings.repmf.sigdig"),
                format=_expect_string(step.get("format"), label="strings.repmf.format"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmf.lenout") if "lenout" in step else None,
            )
        case "strings.repmi":
            return StepStringsRepmi(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmi.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmi.marker"),
                value=_expect_int(step.get("value"), label="strings.repmi.value"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmi.lenout") if "lenout" in step else None,
            )
        case "strings.repml":
            return StepStringsRepml(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repml.input"),
                marker=_expect_string(step.get("marker"), label="strings.repml.marker"),
                value=_expect_bool(step.get("value"), label="strings.repml.value"),
                rtcase=_expect_string(step.get("rtcase"), label="strings.repml.rtcase"),
                lenout=_expect_int(step.get("lenout"), label="strings.repml.lenout") if "lenout" in step else None,
            )
        case "strings.repmot":
            return StepStringsRepmot(
                op=op,
                input=_expect_string(step.get("input"), label="strings.repmot.input"),
                marker=_expect_string(step.get("marker"), label="strings.repmot.marker"),
                value=_expect_int(step.get("value"), label="strings.repmot.value"),
                rtcase=_expect_string(step.get("rtcase"), label="strings.repmot.rtcase"),
                lenout=_expect_int(step.get("lenout"), label="strings.repmot.lenout") if "lenout" in step else None,
            )
        case "strings.nextwd":
            return StepStringsNextwd(
                op=op,
                input=_expect_string(step.get("input"), label="strings.nextwd.input"),
                nexlen=_expect_int(step.get("nexlen"), label="strings.nextwd.nexlen") if "nexlen" in step else None,
                reslen=_expect_int(step.get("reslen"), label="strings.nextwd.reslen") if "reslen" in step else None,
            )

        case "strings.nthwd":
            return StepStringsNthwd(
                op=op,
                input=_expect_string(step.get("input"), label="strings.nthwd.input"),
                nth=_expect_int(step.get("nth"), label="strings.nthwd.nth"),
                worlen=_expect_int(step.get("worlen"), label="strings.nthwd.worlen") if "worlen" in step else None,
            )

        case "strings.lparse":
            return StepStringsLparse(
                op=op,
                list=_expect_string(step.get("list"), label="strings.lparse.list"),
                delim=_expect_string(step.get("delim"), label="strings.lparse.delim"),
                nmax=_expect_int(step.get("nmax"), label="strings.lparse.nmax"),
                itemln=_expect_int(step.get("itemln"), label="strings.lparse.itemln") if "itemln" in step else None,
            )

        case "strings.lparsm":
            return StepStringsLparsm(
                op=op,
                list=_expect_string(step.get("list"), label="strings.lparsm.list"),
                delims=_expect_string(step.get("delims"), label="strings.lparsm.delims"),
                nmax=_expect_int(step.get("nmax"), label="strings.lparsm.nmax"),
                itemln=_expect_int(step.get("itemln"), label="strings.lparsm.itemln") if "itemln" in step else None,
            )

        case "strings.lx4dec":
            return StepStringsLx4dec(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lx4dec.input"),
                first=_expect_int(step.get("first"), label="strings.lx4dec.first"),
            )

        case "strings.lx4num":
            return StepStringsLx4num(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lx4num.input"),
                first=_expect_int(step.get("first"), label="strings.lx4num.first"),
            )

        case "strings.lx4sgn":
            return StepStringsLx4sgn(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lx4sgn.input"),
                first=_expect_int(step.get("first"), label="strings.lx4sgn.first"),
            )

        case "strings.lx4uns":
            return StepStringsLx4uns(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lx4uns.input"),
                first=_expect_int(step.get("first"), label="strings.lx4uns.first"),
            )

        case "strings.lxqstr":
            return StepStringsLxqstr(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lxqstr.input"),
                qchar=_expect_string(step.get("qchar"), label="strings.lxqstr.qchar"),
                first=_expect_int(step.get("first"), label="strings.lxqstr.first"),
            )

        case "strings.cmprss":
            return StepStringsCmprss(
                op=op,
                delim=_expect_string(step.get("delim"), label="strings.cmprss.delim"),
                n=_expect_int(step.get("n"), label="strings.cmprss.n"),
                input=_expect_string(step.get("input"), label="strings.cmprss.input"),
                lenout=_expect_int(step.get("lenout"), label="strings.cmprss.lenout") if "lenout" in step else None,
            )

        case "strings.eqstr":
            return StepStringsEqstr(
                op=op,
                a=_expect_string(step.get("a"), label="strings.eqstr.a"),
                b=_expect_string(step.get("b"), label="strings.eqstr.b"),
            )

        case "strings.iswhsp":
            return StepStringsIswhsp(
                op=op,
                input=_expect_string(step.get("input"), label="strings.iswhsp.input"),
            )

        case "strings.lastnb":
            return StepStringsLastnb(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lastnb.input"),
            )

        case "strings.lcase":
            return StepStringsLcase(
                op=op,
                input=_expect_string(step.get("input"), label="strings.lcase.input"),
                lenout=_expect_int(step.get("lenout"), label="strings.lcase.lenout") if "lenout" in step else None,
            )

        case "strings.ucase":
            return StepStringsUcase(
                op=op,
                input=_expect_string(step.get("input"), label="strings.ucase.input"),
                lenout=_expect_int(step.get("lenout"), label="strings.ucase.lenout") if "lenout" in step else None,
            )

        case "strings.matchi":
            return StepStringsMatchi(
                op=op,
                input=_expect_string(step.get("input"), label="strings.matchi.input"),
                template=_expect_string(step.get("template"), label="strings.matchi.template"),
                wstr=_expect_string(step.get("wstr"), label="strings.matchi.wstr"),
                wchr=_expect_string(step.get("wchr"), label="strings.matchi.wchr"),
            )

        case "strings.matchw":
            return StepStringsMatchw(
                op=op,
                input=_expect_string(step.get("input"), label="strings.matchw.input"),
                template=_expect_string(step.get("template"), label="strings.matchw.template"),
                wstr=_expect_string(step.get("wstr"), label="strings.matchw.wstr"),
                wchr=_expect_string(step.get("wchr"), label="strings.matchw.wchr"),
            )

        case "time.str2et":
            return StepTimeStr2Et(op=op, time=_expect_string(step.get("time"), label="time.str2et.time"))

        case "time.et2utc":
            return StepTimeEt2Utc(
                op=op,
                et=_expect_number(step.get("et"), label="time.et2utc.et"),
                format=_expect_string(step.get("format"), label="time.et2utc.format"),
                prec=_expect_int(step.get("prec"), label="time.et2utc.prec"),
            )

        case "time.spd":
            return StepTimeSpd(op=op)

        case "time.j2000":
            return StepTimeJ2000(op=op)

        case "time.j1900":
            return StepTimeJ1900(op=op)

        case "time.b1950":
            return StepTimeB1950(op=op)

        case "time.b1900":
            return StepTimeB1900(op=op)

        case "time.j1950":
            return StepTimeJ1950(op=op)

        case "time.j2100":
            return StepTimeJ2100(op=op)

        case "time.jyear":
            return StepTimeJyear(op=op)

        case "time.tyear":
            return StepTimeTyear(op=op)

        case "time.tkvrsn":
            item = _expect_string(step.get("item"), label="time.tkvrsn.item")
            return StepTimeTkvrsn(op=op, item=item)

        case "time.timout":
            return StepTimeTimout(
                op=op,
                et=_expect_number(step.get("et"), label="time.timout.et"),
                picture=_expect_string(step.get("picture"), label="time.timout.picture"),
            )

        case "time.deltet":
            eptype = _expect_string(step.get("eptype"), label="time.deltet.eptype")
            if eptype not in {"ET", "UTC"}:
                raise ValueError("time.deltet.eptype must be ET|UTC")
            return StepTimeDeltet(
                op=op,
                epoch=_expect_number(step.get("epoch"), label="time.deltet.epoch"),
                eptype=eptype,
            )

        case "time.unitim":
            return StepTimeUnitim(
                op=op,
                epoch=_expect_number(step.get("epoch"), label="time.unitim.epoch"),
                insys=_expect_string(step.get("insys"), label="time.unitim.insys"),
                outsys=_expect_string(step.get("outsys"), label="time.unitim.outsys"),
            )

        case "time.etcal":
            return StepTimeEtcal(
                op=op,
                et=_expect_number(step.get("et"), label="time.etcal.et"),
                callen=_expect_int(step.get("callen",256), label="time.etcal.callen"),
            )

        case "time.utc2et":
            return StepTimeUtc2et(
                op=op,
                utcstr=_expect_string(step.get("utcstr"), label="time.utc2et.utcstr"),
            )

        case "time.tparch":
            return StepTimeTparch(
                op=op,
                type=_expect_string(step.get("type"), label="time.tparch.type"),
            )

        case "time.tsetyr":
            return StepTimeTsetyr(
                op=op,
                year=_expect_int(step.get("year"), label="time.tsetyr.year"),
            )

        case "time.et2lst":
            return StepTimeEt2lst(
                op=op,
                et=_expect_number(step.get("et"), label="time.et2lst.et"),
                body=_expect_int(step.get("body"), label="time.et2lst.body"),
                lon=_expect_number(step.get("lon"), label="time.et2lst.lon"),
                type=_expect_string(step.get("type"), label="time.et2lst.type"),
                timlen=_expect_int(step.get("timlen",256), label="time.et2lst.timlen"),
                ampmlen=_expect_int(step.get("ampmlen",256), label="time.et2lst.ampmlen"),
            )

        case "time.tparse":
            return StepTimeTparse(
                op=op,
                timstr=_expect_string(step.get("timstr"), label="time.tparse.timstr"),
            )

        case "time.tpictr":
            return StepTimeTpictr(
                op=op,
                sample=_expect_string(step.get("sample"), label="time.tpictr.sample"),
                pictur=_expect_string(step.get("pictur"), label="time.tpictr.pictur"),
            )

        case "time.timdef":
            action = _expect_string(step.get("action"), label="time.timdef.action")
            item = _expect_string(step.get("item"), label="time.timdef.item")
            if action == "GET":
                return StepTimeTimdefGet(op=op, action="GET", item=item)
            if action == "SET":
                return StepTimeTimdefSet(
                    op=op,
                    action="SET",
                    item=item,
                    value=_expect_string(step.get("value"), label="time.timdef.value"),
                )
            raise ValueError("time.timdef.action must be GET|SET")

        case "time.scs2e":
            return StepTimeScs2e(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.scs2e.sc"),
                sclkch=_expect_string(step.get("sclkch"), label="time.scs2e.sclkch"),
            )

        case "time.sce2s":
            return StepTimeSce2s(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sce2s.sc"),
                et=_expect_number(step.get("et"), label="time.sce2s.et"),
            )

        case "time.scencd":
            return StepTimeScencd(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.scencd.sc"),
                sclkch=_expect_string(step.get("sclkch"), label="time.scencd.sclkch"),
            )

        case "time.scdecd":
            return StepTimeScdecd(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.scdecd.sc"),
                sclkdp=_expect_number(step.get("sclkdp"), label="time.scdecd.sclkdp"),
            )

        case "time.sct2e":
            return StepTimeSct2e(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sct2e.sc"),
                sclkdp=_expect_number(step.get("sclkdp"), label="time.sct2e.sclkdp"),
            )

        case "time.sce2t":
            return StepTimeSce2t(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sce2t.sc"),
                et=_expect_number(step.get("et"), label="time.sce2t.et"),
            )

        case "time.scfmt":
            return StepTimeScfmt(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.scfmt.sc"),
                ticks=_expect_number(step.get("ticks"), label="time.scfmt.ticks"),
                clklen=_expect_int(step.get("clklen", 2048), label="time.scfmt.clklen"),
            )

        case "time.scpart":
            return StepTimeScpart(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.scpart.sc"),
            )

        case "time.sctiks":
            return StepTimeSctiks(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sctiks.sc"),
                clkstr=_expect_string(step.get("clkstr"), label="time.sctiks.clkstr"),
            )

        case "time.sce2c":
            return StepTimeSce2c(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sce2c.sc"),
                et=_expect_number(step.get("et"), label="time.sce2c.et"),
            )

        case "ids-names.srfc2s":
            return StepIdsNamesSrfc2s(op=op, code=_expect_int(step.get("code"), label="ids-names.srfc2s.code"),bodyId=_expect_int(step.get("bodyId"), label="ids-names.srfc2s.bodyId"),srflen=_expect_int(step.get("srflen",37), label="ids-names.srfc2s.srflen"))

        case "ids-names.srfcss":
            return StepIdsNamesSrfcss(op=op, code=_expect_int(step.get("code"), label="ids-names.srfcss.code"),body=_expect_string(step.get("body"), label="ids-names.srfcss.body"),srflen=_expect_int(step.get("srflen",37), label="ids-names.srfcss.srflen"))

        case "ids-names.srfs2c":
            return StepIdsNamesSrfs2c(op=op, surface=_expect_string(step.get("surface"), label="ids-names.srfs2c.surface"),body=_expect_string(step.get("body"), label="ids-names.srfs2c.body"))

        case "ids-names.srfscc":
            return StepIdsNamesSrfscc(op=op, surface=_expect_string(step.get("surface"), label="ids-names.srfscc.surface"),bodyId=_expect_int(step.get("bodyId"), label="ids-names.srfscc.bodyId"))

        case "ids-names.bodn2c":
            return StepIdsNamesBodn2c(op=op, name=_expect_string(step.get("name"), label="ids-names.bodn2c.name"))

        case "ids-names.bodc2n":
            return StepIdsNamesBodc2n(op=op, code=_expect_int(step.get("code"), label="ids-names.bodc2n.code"))

        case "ids-names.bodc2s":
            return StepIdsNamesBodc2s(op=op, code=_expect_int(step.get("code"), label="ids-names.bodc2s.code"))

        case "ids-names.boddef":
            return StepIdsNamesBoddef(
                op=op,
                name=_expect_string(step.get("name"), label="ids-names.boddef.name"),
                code=_expect_int(step.get("code"), label="ids-names.boddef.code"),
            )

        case "ids-names.bodfnd":
            return StepIdsNamesBodfnd(
                op=op,
                body=_expect_int(step.get("body"), label="ids-names.bodfnd.body"),
                item=_expect_string(step.get("item"), label="ids-names.bodfnd.item"),
            )

        case "ids-names.bods2c":
            return StepIdsNamesBods2c(op=op, name=_expect_string(step.get("name"), label="ids-names.bods2c.name"))

        case "ids-names.bodvar":
            return StepIdsNamesBodvar(
                op=op,
                body=_expect_int(step.get("body"), label="ids-names.bodvar.body"),
                item=_expect_string(step.get("item"), label="ids-names.bodvar.item"),
            )

        case "coords-vectors.isordv":
            return StepCoordsVectorsIsordv(op=op,
                order=_expect_int_list(step.get("order"), label="coords-vectors.isordv.order"),
            )
        case "coords-vectors.orderc":
            return StepCoordsVectorsOrderc(op=op,
                values=_expect_string_list(step.get("values"), label="coords-vectors.orderc.values"),
            )
        case "coords-vectors.orderd":
            return StepCoordsVectorsOrderd(op=op,
                values=_expect_number_list(step.get("values"), label="coords-vectors.orderd.values"),
            )
        case "coords-vectors.orderi":
            return StepCoordsVectorsOrderi(op=op,
                values=_expect_int_list(step.get("values"), label="coords-vectors.orderi.values"),
            )
        case "coords-vectors.reordc":
            return StepCoordsVectorsReordc(op=op,
                order=_expect_int_list(step.get("order"), label="coords-vectors.reordc.order"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.reordc.values"),
            )
        case "coords-vectors.reordd":
            return StepCoordsVectorsReordd(op=op,
                order=_expect_int_list(step.get("order"), label="coords-vectors.reordd.order"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.reordd.values"),
            )
        case "coords-vectors.reordi":
            return StepCoordsVectorsReordi(op=op,
                order=_expect_int_list(step.get("order"), label="coords-vectors.reordi.order"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.reordi.values"),
            )
        case "coords-vectors.reordl":
            return StepCoordsVectorsReordl(op=op,
                order=_expect_int_list(step.get("order"), label="coords-vectors.reordl.order"),
                values=_expect_bool_list(step.get("values"), label="coords-vectors.reordl.values"),
            )
        case "coords-vectors.shellc":
            return StepCoordsVectorsShellc(op=op,
                values=_expect_string_list(step.get("values"), label="coords-vectors.shellc.values"),
            )
        case "coords-vectors.shelld":
            return StepCoordsVectorsShelld(op=op,
                values=_expect_number_list(step.get("values"), label="coords-vectors.shelld.values"),
            )
        case "coords-vectors.shelli":
            return StepCoordsVectorsShelli(op=op,
                values=_expect_int_list(step.get("values"), label="coords-vectors.shelli.values"),
            )
        case "coords-vectors.lstlec":
            return StepCoordsVectorsLstlec(
                op=op,
                key=_expect_string(step.get("key"), label="coords-vectors.lstlec.key"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.lstlec.values"),
            )

        case "coords-vectors.lstled":
            return StepCoordsVectorsLstled(
                op=op,
                key=_expect_number(step.get("key"), label="coords-vectors.lstled.key"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.lstled.values"),
            )

        case "coords-vectors.lstlei":
            return StepCoordsVectorsLstlei(
                op=op,
                key=_expect_int(step.get("key"), label="coords-vectors.lstlei.key"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.lstlei.values"),
            )

        case "coords-vectors.lstltc":
            return StepCoordsVectorsLstltc(
                op=op,
                key=_expect_string(step.get("key"), label="coords-vectors.lstltc.key"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.lstltc.values"),
            )

        case "coords-vectors.lstltd":
            return StepCoordsVectorsLstltd(
                op=op,
                key=_expect_number(step.get("key"), label="coords-vectors.lstltd.key"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.lstltd.values"),
            )

        case "coords-vectors.lstlti":
            return StepCoordsVectorsLstlti(
                op=op,
                key=_expect_int(step.get("key"), label="coords-vectors.lstlti.key"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.lstlti.values"),
            )

        case "coords-vectors.bschoc":
            return StepCoordsVectorsBschoc(
                op=op,
                key=_expect_string(step.get("key"), label="coords-vectors.bschoc.key"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.bschoc.values"),
                order=_expect_int_list(step.get("order"), label="coords-vectors.bschoc.order"),
            )

        case "coords-vectors.bschoi":
            return StepCoordsVectorsBschoi(
                op=op,
                key=_expect_int(step.get("key"), label="coords-vectors.bschoi.key"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.bschoi.values"),
                order=_expect_int_list(step.get("order"), label="coords-vectors.bschoi.order"),
            )

        case "coords-vectors.bsrchc":
            return StepCoordsVectorsBsrchc(
                op=op,
                key=_expect_string(step.get("key"), label="coords-vectors.bsrchc.key"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.bsrchc.values"),
            )

        case "coords-vectors.bsrchd":
            return StepCoordsVectorsBsrchd(
                op=op,
                key=_expect_number(step.get("key"), label="coords-vectors.bsrchd.key"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.bsrchd.values"),
            )

        case "coords-vectors.bsrchi":
            return StepCoordsVectorsBsrchi(
                op=op,
                key=_expect_int(step.get("key"), label="coords-vectors.bsrchi.key"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.bsrchi.values"),
            )

        case "coords-vectors.isrchc":
            return StepCoordsVectorsIsrchc(
                op=op,
                key=_expect_string(step.get("key"), label="coords-vectors.isrchc.key"),
                values=_expect_string_list(step.get("values"), label="coords-vectors.isrchc.values"),
            )

        case "coords-vectors.isrchd":
            return StepCoordsVectorsIsrchd(
                op=op,
                key=_expect_number(step.get("key"), label="coords-vectors.isrchd.key"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.isrchd.values"),
            )

        case "coords-vectors.isrchi":
            return StepCoordsVectorsIsrchi(
                op=op,
                key=_expect_int(step.get("key"), label="coords-vectors.isrchi.key"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.isrchi.values"),
            )

        case "coords-vectors.mequg":
            return StepCoordsVectorsMequg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mequg.m1"),
                nr=_expect_int(step.get("nr"), label="coords-vectors.mequg.nr"),
                nc=_expect_int(step.get("nc"), label="coords-vectors.mequg.nc"),
            )

        case "coords-vectors.mtxmg":
            return StepCoordsVectorsMtxmg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mtxmg.m1"),
                m2=_expect_number_list(step.get("m2"), label="coords-vectors.mtxmg.m2"),
                nc1=_expect_int(step.get("nc1"), label="coords-vectors.mtxmg.nc1"),
                nr1r2=_expect_int(step.get("nr1r2"), label="coords-vectors.mtxmg.nr1r2"),
                nc2=_expect_int(step.get("nc2"), label="coords-vectors.mtxmg.nc2"),
            )

        case "coords-vectors.mtxvg":
            return StepCoordsVectorsMtxvg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mtxvg.m1"),
                v2=_expect_number_list(step.get("v2"), label="coords-vectors.mtxvg.v2"),
                nc1=_expect_int(step.get("nc1"), label="coords-vectors.mtxvg.nc1"),
                nr1r2=_expect_int(step.get("nr1r2"), label="coords-vectors.mtxvg.nr1r2"),
            )

        case "coords-vectors.mxmg":
            return StepCoordsVectorsMxmg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mxmg.m1"),
                m2=_expect_number_list(step.get("m2"), label="coords-vectors.mxmg.m2"),
                nr1=_expect_int(step.get("nr1"), label="coords-vectors.mxmg.nr1"),
                nc1r2=_expect_int(step.get("nc1r2"), label="coords-vectors.mxmg.nc1r2"),
                nc2=_expect_int(step.get("nc2"), label="coords-vectors.mxmg.nc2"),
            )

        case "coords-vectors.mxmtg":
            return StepCoordsVectorsMxmtg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mxmtg.m1"),
                m2=_expect_number_list(step.get("m2"), label="coords-vectors.mxmtg.m2"),
                nr1=_expect_int(step.get("nr1"), label="coords-vectors.mxmtg.nr1"),
                nc1c2=_expect_int(step.get("nc1c2"), label="coords-vectors.mxmtg.nc1c2"),
                nr2=_expect_int(step.get("nr2"), label="coords-vectors.mxmtg.nr2"),
            )

        case "coords-vectors.mxvg":
            return StepCoordsVectorsMxvg(
                op=op,
                m1=_expect_number_list(step.get("m1"), label="coords-vectors.mxvg.m1"),
                v2=_expect_number_list(step.get("v2"), label="coords-vectors.mxvg.v2"),
                nr1=_expect_int(step.get("nr1"), label="coords-vectors.mxvg.nr1"),
                nc1r2=_expect_int(step.get("nc1r2"), label="coords-vectors.mxvg.nc1r2"),
            )

        case "coords-vectors.vtmvg":
            return StepCoordsVectorsVtmvg(
                op=op,
                v1=_expect_number_list(step.get("v1"), label="coords-vectors.vtmvg.v1"),
                matrix=_expect_number_list(step.get("matrix"), label="coords-vectors.vtmvg.matrix"),
                v2=_expect_number_list(step.get("v2"), label="coords-vectors.vtmvg.v2"),
                nrow=_expect_int(step.get("nrow"), label="coords-vectors.vtmvg.nrow"),
                ncol=_expect_int(step.get("ncol"), label="coords-vectors.vtmvg.ncol"),
            )

        case "coords-vectors.xposeg":
            return StepCoordsVectorsXposeg(
                op=op,
                matrix=_expect_number_list(step.get("matrix"), label="coords-vectors.xposeg.matrix"),
                nrow=_expect_int(step.get("nrow"), label="coords-vectors.xposeg.nrow"),
                ncol=_expect_int(step.get("ncol"), label="coords-vectors.xposeg.ncol"),
            )

        case "coords-vectors.vaddg":
            return StepCoordsVectorsVaddg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vaddg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vaddg.b"),
            )

        case "coords-vectors.vdistg":
            return StepCoordsVectorsVdistg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vdistg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vdistg.b"),
            )

        case "coords-vectors.vdotg":
            return StepCoordsVectorsVdotg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vdotg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vdotg.b"),
            )

        case "coords-vectors.vequg":
            return StepCoordsVectorsVequg(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.vequg.v"),
            )

        case "coords-vectors.vhatg":
            return StepCoordsVectorsVhatg(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.vhatg.v"),
            )

        case "coords-vectors.vlcomg":
            return StepCoordsVectorsVlcomg(
                op=op,
                a=_expect_number(step.get("a"), label="coords-vectors.vlcomg.a"),
                v1=_expect_number_list(step.get("v1"), label="coords-vectors.vlcomg.v1"),
                b=_expect_number(step.get("b"), label="coords-vectors.vlcomg.b"),
                v2=_expect_number_list(step.get("v2"), label="coords-vectors.vlcomg.v2"),
            )

        case "coords-vectors.vminug":
            return StepCoordsVectorsVminug(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.vminug.v"),
            )

        case "coords-vectors.vnormg":
            return StepCoordsVectorsVnormg(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.vnormg.v"),
            )

        case "coords-vectors.vprojg":
            return StepCoordsVectorsVprojg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vprojg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vprojg.b"),
            )

        case "coords-vectors.vrelg":
            return StepCoordsVectorsVrelg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vrelg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vrelg.b"),
            )

        case "coords-vectors.vsclg":
            return StepCoordsVectorsVsclg(
                op=op,
                s=_expect_number(step.get("s"), label="coords-vectors.vsclg.s"),
                v=_expect_number_list(step.get("v"), label="coords-vectors.vsclg.v"),
            )

        case "coords-vectors.vsepg":
            return StepCoordsVectorsVsepg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vsepg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vsepg.b"),
            )

        case "coords-vectors.vsubg":
            return StepCoordsVectorsVsubg(
                op=op,
                a=_expect_number_list(step.get("a"), label="coords-vectors.vsubg.a"),
                b=_expect_number_list(step.get("b"), label="coords-vectors.vsubg.b"),
            )

        case "coords-vectors.vzerog":
            return StepCoordsVectorsVzerog(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.vzerog.v"),
            )

        case "coords-vectors.unormg":
            return StepCoordsVectorsUnormg(
                op=op,
                v=_expect_number_list(step.get("v"), label="coords-vectors.unormg.v"),
            )

        case "coords-vectors.eul2m":
            return StepCoordsVectorsEul2m(
                op=op,
                angle3=_expect_number(step.get("angle3"), label="coords-vectors.eul2m.angle3"),
                angle2=_expect_number(step.get("angle2"), label="coords-vectors.eul2m.angle2"),
                angle1=_expect_number(step.get("angle1"), label="coords-vectors.eul2m.angle1"),
                axis3=_expect_int(step.get("axis3"), label="coords-vectors.eul2m.axis3"),
                axis2=_expect_int(step.get("axis2"), label="coords-vectors.eul2m.axis2"),
                axis1=_expect_int(step.get("axis1"), label="coords-vectors.eul2m.axis1"),
            )
        case "coords-vectors.m2eul":
            return StepCoordsVectorsM2eul(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.m2eul.m"),
                axis3=_expect_int(step.get("axis3"), label="coords-vectors.m2eul.axis3"),
                axis2=_expect_int(step.get("axis2"), label="coords-vectors.m2eul.axis2"),
                axis1=_expect_int(step.get("axis1"), label="coords-vectors.m2eul.axis1"),
            )
        case "coords-vectors.m2q":
            return StepCoordsVectorsM2q(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.m2q.m"),
            )
        case "coords-vectors.q2m":
            return StepCoordsVectorsQ2m(
                op=op,
                q=_expect_vec4(step.get("q"), label="coords-vectors.q2m.q"),
            )
        case "coords-vectors.qxq":
            return StepCoordsVectorsQxq(
                op=op,
                q1=_expect_vec4(step.get("q1"), label="coords-vectors.qxq.q1"),
                q2=_expect_vec4(step.get("q2"), label="coords-vectors.qxq.q2"),
            )
        case "coords-vectors.qdq2av":
            return StepCoordsVectorsQdq2av(
                op=op,
                q=_expect_vec4(step.get("q"), label="coords-vectors.qdq2av.q"),
                dq=_expect_vec4(step.get("dq"), label="coords-vectors.qdq2av.dq"),
            )
        case "coords-vectors.raxisa":
            return StepCoordsVectorsRaxisa(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.raxisa.m"),
            )
        case "coords-vectors.det":
            return StepCoordsVectorsDet(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.det.m"),
            )

        case "coords-vectors.diags2":
            return StepCoordsVectorsDiags2(
                op=op,
                symmat=_expect_vec4(step.get("symmat"), label="coords-vectors.diags2.symmat"),
            )

        case "coords-vectors.ident":
            return StepCoordsVectorsIdent(
                op=op,
            )

        case "coords-vectors.invert":
            return StepCoordsVectorsInvert(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.invert.m"),
            )

        case "coords-vectors.invort":
            return StepCoordsVectorsInvort(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.invort.m"),
            )

        case "coords-vectors.isrot":
            return StepCoordsVectorsIsrot(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.isrot.m"),
                ntol=_expect_number(step.get("ntol"), label="coords-vectors.isrot.ntol"),
                dtol=_expect_number(step.get("dtol"), label="coords-vectors.isrot.dtol"),
            )

        case "coords-vectors.mequ":
            return StepCoordsVectorsMequ(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.mequ.m"),
            )

        case "coords-vectors.mtxm":
            return StepCoordsVectorsMtxm(
                op=op,
                a=_expect_3x3_matrix(step.get("a"), label="coords-vectors.mtxm.a"),
                b=_expect_3x3_matrix(step.get("b"), label="coords-vectors.mtxm.b"),
            )

        case "coords-vectors.mxmt":
            return StepCoordsVectorsMxmt(
                op=op,
                a=_expect_3x3_matrix(step.get("a"), label="coords-vectors.mxmt.a"),
                b=_expect_3x3_matrix(step.get("b"), label="coords-vectors.mxmt.b"),
            )

        case "coords-vectors.trace":
            return StepCoordsVectorsTrace(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.trace.m"),
            )

        case "coords-vectors.xpose":
            return StepCoordsVectorsXpose(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.xpose.m"),
            )

        case "coords-vectors.dazldr":
            return StepCoordsVectorsDazldr(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.dazldr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dazldr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dazldr.z"),
                azccw=_expect_bool(step.get("azccw"), label="coords-vectors.dazldr.azccw"),
                elplsz=_expect_bool(step.get("elplsz"), label="coords-vectors.dazldr.elplsz"),
            )

        case "coords-vectors.dcyldr":
            return StepCoordsVectorsDcyldr(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.dcyldr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dcyldr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dcyldr.z"),
            )

        case "coords-vectors.dgeodr":
            return StepCoordsVectorsDgeodr(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.dgeodr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dgeodr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dgeodr.z"),
                re=_expect_number(step.get("re"), label="coords-vectors.dgeodr.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.dgeodr.f"),
            )

        case "coords-vectors.dlatdr":
            return StepCoordsVectorsDlatdr(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.dlatdr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dlatdr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dlatdr.z"),
            )

        case "coords-vectors.dpgrdr":
            return StepCoordsVectorsDpgrdr(
                op=op,
                body=_expect_string(step.get("body"), label="coords-vectors.dpgrdr.body"),
                x=_expect_number(step.get("x"), label="coords-vectors.dpgrdr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dpgrdr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dpgrdr.z"),
                re=_expect_number(step.get("re"), label="coords-vectors.dpgrdr.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.dpgrdr.f"),
            )

        case "coords-vectors.drdazl":
            return StepCoordsVectorsDrdazl(
                op=op,
                range=_expect_number(step.get("range"), label="coords-vectors.drdazl.range"),
                az=_expect_number(step.get("az"), label="coords-vectors.drdazl.az"),
                el=_expect_number(step.get("el"), label="coords-vectors.drdazl.el"),
                azccw=_expect_bool(step.get("azccw"), label="coords-vectors.drdazl.azccw"),
                elplsz=_expect_bool(step.get("elplsz"), label="coords-vectors.drdazl.elplsz"),
            )

        case "coords-vectors.drdcyl":
            return StepCoordsVectorsDrdcyl(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.drdcyl.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.drdcyl.lon"),
                z=_expect_number(step.get("z"), label="coords-vectors.drdcyl.z"),
            )

        case "coords-vectors.drdgeo":
            return StepCoordsVectorsDrdgeo(
                op=op,
                lon=_expect_number(step.get("lon"), label="coords-vectors.drdgeo.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.drdgeo.lat"),
                alt=_expect_number(step.get("alt"), label="coords-vectors.drdgeo.alt"),
                re=_expect_number(step.get("re"), label="coords-vectors.drdgeo.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.drdgeo.f"),
            )

        case "coords-vectors.drdlat":
            return StepCoordsVectorsDrdlat(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.drdlat.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.drdlat.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.drdlat.lat"),
            )

        case "coords-vectors.drdpgr":
            return StepCoordsVectorsDrdpgr(
                op=op,
                body=_expect_string(step.get("body"), label="coords-vectors.drdpgr.body"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.drdpgr.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.drdpgr.lat"),
                alt=_expect_number(step.get("alt"), label="coords-vectors.drdpgr.alt"),
                re=_expect_number(step.get("re"), label="coords-vectors.drdpgr.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.drdpgr.f"),
            )

        case "coords-vectors.drdsph":
            return StepCoordsVectorsDrdsph(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.drdsph.radius"),
                colat=_expect_number(step.get("colat"), label="coords-vectors.drdsph.colat"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.drdsph.lon"),
            )

        case "coords-vectors.dsphdr":
            return StepCoordsVectorsDsphdr(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.dsphdr.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.dsphdr.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.dsphdr.z"),
            )

        case "coords-vectors.clearc":
            return StepCoordsVectorsClearc(
                op=op,
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.clearc.ndim"),
                arrlen=_expect_int(step.get("arrlen"), label="coords-vectors.clearc.arrlen"),
                bytes=_expect_int_list(step.get("bytes"), label="coords-vectors.clearc.bytes"),
            )

        case "coords-vectors.cleard":
            return StepCoordsVectorsCleard(
                op=op,
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.cleard.ndim"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.cleard.values"),
            )

        case "coords-vectors.cleari":
            return StepCoordsVectorsCleari(
                op=op,
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.cleari.ndim"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.cleari.values"),
            )

        case "coords-vectors.filld":
            return StepCoordsVectorsFilld(
                op=op,
                value=_expect_number(step.get("value"), label="coords-vectors.filld.value"),
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.filld.ndim"),
                values=_expect_number_list(step.get("values"), label="coords-vectors.filld.values"),
            )

        case "coords-vectors.filli":
            return StepCoordsVectorsFilli(
                op=op,
                value=_expect_int(step.get("value"), label="coords-vectors.filli.value"),
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.filli.ndim"),
                values=_expect_int_list(step.get("values"), label="coords-vectors.filli.values"),
            )

        case "coords-vectors.moved":
            return StepCoordsVectorsMoved(
                op=op,
                source=_expect_number_list(step.get("source"), label="coords-vectors.moved.source"),
                ndim=_expect_int(step.get("ndim"), label="coords-vectors.moved.ndim"),
                destination=_expect_number_list(step.get("destination"), label="coords-vectors.moved.destination"),
            )

        case "coords-vectors.hrmesp":
            return StepCoordsVectorsHrmesp(
                op=op,
                first=_expect_number(step.get("first"), label="coords-vectors.hrmesp.first"),
                step=_expect_number(step.get("step"), label="coords-vectors.hrmesp.step"),
                yvals=_expect_number_list(step.get("yvals"), label="coords-vectors.hrmesp.yvals"),
                x=_expect_number(step.get("x"), label="coords-vectors.hrmesp.x"),
            )

        case "coords-vectors.hrmint":
            return StepCoordsVectorsHrmint(
                op=op,
                xvals=_expect_number_list(step.get("xvals"), label="coords-vectors.hrmint.xvals"),
                yvals=_expect_number_list(step.get("yvals"), label="coords-vectors.hrmint.yvals"),
                x=_expect_number(step.get("x"), label="coords-vectors.hrmint.x"),
            )

        case "coords-vectors.lgresp":
            return StepCoordsVectorsLgresp(
                op=op,
                first=_expect_number(step.get("first"), label="coords-vectors.lgresp.first"),
                step=_expect_number(step.get("step"), label="coords-vectors.lgresp.step"),
                yvals=_expect_number_list(step.get("yvals"), label="coords-vectors.lgresp.yvals"),
                x=_expect_number(step.get("x"), label="coords-vectors.lgresp.x"),
            )

        case "coords-vectors.lgrind":
            return StepCoordsVectorsLgrind(
                op=op,
                xvals=_expect_number_list(step.get("xvals"), label="coords-vectors.lgrind.xvals"),
                yvals=_expect_number_list(step.get("yvals"), label="coords-vectors.lgrind.yvals"),
                x=_expect_number(step.get("x"), label="coords-vectors.lgrind.x"),
            )

        case "coords-vectors.lgrint":
            return StepCoordsVectorsLgrint(
                op=op,
                xvals=_expect_number_list(step.get("xvals"), label="coords-vectors.lgrint.xvals"),
                yvals=_expect_number_list(step.get("yvals"), label="coords-vectors.lgrint.yvals"),
                x=_expect_number(step.get("x"), label="coords-vectors.lgrint.x"),
            )

        case "coords-vectors.qderiv":
            return StepCoordsVectorsQderiv(
                op=op,
                f0=_expect_number_list(step.get("f0"), label="coords-vectors.qderiv.f0"),
                f2=_expect_number_list(step.get("f2"), label="coords-vectors.qderiv.f2"),
                delta=_expect_number(step.get("delta"), label="coords-vectors.qderiv.delta"),
            )

        case "coords-vectors.chbder":
            return StepCoordsVectorsChbder(
                op=op,
                cp=_expect_number_list(step.get("cp"), label="coords-vectors.chbder.cp"),
                x2s=_expect_vec2(step.get("x2s"), label="coords-vectors.chbder.x2s"),
                x=_expect_number(step.get("x"), label="coords-vectors.chbder.x"),
                nderiv=_expect_int(step.get("nderiv"), label="coords-vectors.chbder.nderiv"),
            )

        case "coords-vectors.chbigr":
            return StepCoordsVectorsChbigr(
                op=op,
                cp=_expect_number_list(step.get("cp"), label="coords-vectors.chbigr.cp"),
                x2s=_expect_vec2(step.get("x2s"), label="coords-vectors.chbigr.x2s"),
                x=_expect_number(step.get("x"), label="coords-vectors.chbigr.x"),
            )

        case "coords-vectors.chbint":
            return StepCoordsVectorsChbint(
                op=op,
                cp=_expect_number_list(step.get("cp"), label="coords-vectors.chbint.cp"),
                x2s=_expect_vec2(step.get("x2s"), label="coords-vectors.chbint.x2s"),
                x=_expect_number(step.get("x"), label="coords-vectors.chbint.x"),
            )

        case "coords-vectors.chbval":
            return StepCoordsVectorsChbval(
                op=op,
                cp=_expect_number_list(step.get("cp"), label="coords-vectors.chbval.cp"),
                x2s=_expect_vec2(step.get("x2s"), label="coords-vectors.chbval.x2s"),
                x=_expect_number(step.get("x"), label="coords-vectors.chbval.x"),
            )

        case "coords-vectors.polyds":
            return StepCoordsVectorsPolyds(
                op=op,
                coeffs=_expect_number_list(step.get("coeffs"), label="coords-vectors.polyds.coeffs"),
                nderiv=_expect_int(step.get("nderiv"), label="coords-vectors.polyds.nderiv"),
                t=_expect_number(step.get("t"), label="coords-vectors.polyds.t"),
            )

        case "coords-vectors.rquad":
            return StepCoordsVectorsRquad(
                op=op,
                a=_expect_number(step.get("a"), label="coords-vectors.rquad.a"),
                b=_expect_number(step.get("b"), label="coords-vectors.rquad.b"),
                c=_expect_number(step.get("c"), label="coords-vectors.rquad.c"),
            )

        case "coords-vectors.ducrss":
            return StepCoordsVectorsDucrss(
                op=op,
                a=_expect_vec6(step.get("a"), label="coords-vectors.ducrss.a"),
                b=_expect_vec6(step.get("b"), label="coords-vectors.ducrss.b"),
            )

        case "coords-vectors.dvcrss":
            return StepCoordsVectorsDvcrss(
                op=op,
                a=_expect_vec6(step.get("a"), label="coords-vectors.dvcrss.a"),
                b=_expect_vec6(step.get("b"), label="coords-vectors.dvcrss.b"),
            )

        case "coords-vectors.dvdot":
            return StepCoordsVectorsDvdot(
                op=op,
                a=_expect_vec6(step.get("a"), label="coords-vectors.dvdot.a"),
                b=_expect_vec6(step.get("b"), label="coords-vectors.dvdot.b"),
            )

        case "coords-vectors.dvhat":
            return StepCoordsVectorsDvhat(
                op=op,
                state=_expect_vec6(step.get("state"), label="coords-vectors.dvhat.state"),
            )

        case "coords-vectors.dvnorm":
            return StepCoordsVectorsDvnorm(
                op=op,
                state=_expect_vec6(step.get("state"), label="coords-vectors.dvnorm.state"),
            )

        case "coords-vectors.dvsep":
            return StepCoordsVectorsDvsep(
                op=op,
                a=_expect_vec6(step.get("a"), label="coords-vectors.dvsep.a"),
                b=_expect_vec6(step.get("b"), label="coords-vectors.dvsep.b"),
            )

        case "coords-vectors.brcktd":
            return StepCoordsVectorsBrcktd(
                op=op,
                value=_expect_number(step.get("value"), label="coords-vectors.brcktd.value"),
                end1=_expect_number(step.get("end1"), label="coords-vectors.brcktd.end1"),
                end2=_expect_number(step.get("end2"), label="coords-vectors.brcktd.end2"),
            )

        case "coords-vectors.brckti":
            return StepCoordsVectorsBrckti(
                op=op,
                value=_expect_int(step.get("value"), label="coords-vectors.brckti.value"),
                end1=_expect_int(step.get("end1"), label="coords-vectors.brckti.end1"),
                end2=_expect_int(step.get("end2"), label="coords-vectors.brckti.end2"),
            )

        case "coords-vectors.convrt":
            return StepCoordsVectorsConvrt(
                op=op,
                value=_expect_number(step.get("value"), label="coords-vectors.convrt.value"),
                inUnit=_expect_string(step.get("inUnit"), label="coords-vectors.convrt.inUnit"),
                outUnit=_expect_string(step.get("outUnit"), label="coords-vectors.convrt.outUnit"),
            )

        case "coords-vectors.sumad":
            return StepCoordsVectorsSumad(
                op=op,
                values=_expect_number_list(step.get("values"), label="coords-vectors.sumad.values"),
            )

        case "coords-vectors.sumai":
            return StepCoordsVectorsSumai(
                op=op,
                values=_expect_int_list(step.get("values"), label="coords-vectors.sumai.values"),
            )

        case "coords-vectors.maxd":
            return StepCoordsVectorsMaxd(
                op=op,
                values=_expect_number_list(step.get("values"), label="coords-vectors.maxd.values"),
            )

        case "coords-vectors.maxi":
            return StepCoordsVectorsMaxi(
                op=op,
                values=_expect_int_list(step.get("values"), label="coords-vectors.maxi.values"),
            )

        case "coords-vectors.mind":
            return StepCoordsVectorsMind(
                op=op,
                values=_expect_number_list(step.get("values"), label="coords-vectors.mind.values"),
            )

        case "coords-vectors.mini":
            return StepCoordsVectorsMini(
                op=op,
                values=_expect_int_list(step.get("values"), label="coords-vectors.mini.values"),
            )

        case "coords-vectors.azlrec":
            return StepCoordsVectorsAzlrec(
                op=op,
                range=_expect_number(step.get("range"), label="coords-vectors.azlrec.range"),
                az=_expect_number(step.get("az"), label="coords-vectors.azlrec.az"),
                el=_expect_number(step.get("el"), label="coords-vectors.azlrec.el"),
                azccw=_expect_bool(step.get("azccw"), label="coords-vectors.azlrec.azccw"),
                elplsz=_expect_bool(step.get("elplsz"), label="coords-vectors.azlrec.elplsz"),
            )

        case "coords-vectors.recazl":
            return StepCoordsVectorsRecazl(
                op=op,
                rect=_expect_vec3(step.get("rect"), label="coords-vectors.recazl.rect"),
                azccw=_expect_bool(step.get("azccw"), label="coords-vectors.recazl.azccw"),
                elplsz=_expect_bool(step.get("elplsz"), label="coords-vectors.recazl.elplsz"),
            )

        case "coords-vectors.pgrrec":
            return StepCoordsVectorsPgrrec(
                op=op,
                body=_expect_string(step.get("body"), label="coords-vectors.pgrrec.body"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.pgrrec.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.pgrrec.lat"),
                alt=_expect_number(step.get("alt"), label="coords-vectors.pgrrec.alt"),
                re=_expect_number(step.get("re"), label="coords-vectors.pgrrec.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.pgrrec.f"),
            )

        case "coords-vectors.recpgr":
            return StepCoordsVectorsRecpgr(
                op=op,
                body=_expect_string(step.get("body"), label="coords-vectors.recpgr.body"),
                rect=_expect_vec3(step.get("rect"), label="coords-vectors.recpgr.rect"),
                re=_expect_number(step.get("re"), label="coords-vectors.recpgr.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.recpgr.f"),
            )

        case "coords-vectors.radrec":
            return StepCoordsVectorsRadrec(
                op=op,
                range=_expect_number(step.get("range"), label="coords-vectors.radrec.range"),
                ra=_expect_number(step.get("ra"), label="coords-vectors.radrec.ra"),
                dec=_expect_number(step.get("dec"), label="coords-vectors.radrec.dec"),
            )

        case "coords-vectors.recrad":
            return StepCoordsVectorsRecrad(
                op=op,
                rect=_expect_vec3(step.get("rect"), label="coords-vectors.recrad.rect"),
            )

        case "coords-vectors.srfrec":
            return StepCoordsVectorsSrfrec(
                op=op,
                body=_expect_int(step.get("body"), label="coords-vectors.srfrec.body"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.srfrec.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.srfrec.lat"),
            )

        case "coords-vectors.vlcom":
            return StepCoordsVectorsVlcom(
                op=op,
                a=_expect_number(step.get("a"), label="coords-vectors.vlcom.a"),
                v1=_expect_vec3(step.get("v1"), label="coords-vectors.vlcom.v1"),
                b=_expect_number(step.get("b"), label="coords-vectors.vlcom.b"),
                v2=_expect_vec3(step.get("v2"), label="coords-vectors.vlcom.v2"),
            )

        case "coords-vectors.vlcom3":
            return StepCoordsVectorsVlcom3(
                op=op,
                a=_expect_number(step.get("a"), label="coords-vectors.vlcom3.a"),
                v1=_expect_vec3(step.get("v1"), label="coords-vectors.vlcom3.v1"),
                b=_expect_number(step.get("b"), label="coords-vectors.vlcom3.b"),
                v2=_expect_vec3(step.get("v2"), label="coords-vectors.vlcom3.v2"),
                c=_expect_number(step.get("c"), label="coords-vectors.vlcom3.c"),
                v3=_expect_vec3(step.get("v3"), label="coords-vectors.vlcom3.v3"),
            )

        case "coords-vectors.vperp":
            return StepCoordsVectorsVperp(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vperp.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vperp.b"),
            )

        case "coords-vectors.vproj":
            return StepCoordsVectorsVproj(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vproj.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vproj.b"),
            )

        case "coords-vectors.vrel":
            return StepCoordsVectorsVrel(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vrel.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vrel.b"),
            )

        case "coords-vectors.vrotv":
            return StepCoordsVectorsVrotv(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.vrotv.v"),
                axis=_expect_vec3(step.get("axis"), label="coords-vectors.vrotv.axis"),
                theta=_expect_number(step.get("theta"), label="coords-vectors.vrotv.theta"),
            )

        case "coords-vectors.rotvec":
            return StepCoordsVectorsRotvec(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.rotvec.v"),
                angle=_expect_number(step.get("angle"), label="coords-vectors.rotvec.angle"),
                axis=_expect_int(step.get("axis"), label="coords-vectors.rotvec.axis"),
            )

        case "coords-vectors.vtmv":
            return StepCoordsVectorsVtmv(
                op=op,
                v1=_expect_vec3(step.get("v1"), label="coords-vectors.vtmv.v1"),
                matrix=_expect_3x3_matrix(step.get("matrix"), label="coords-vectors.vtmv.matrix"),
                v2=_expect_vec3(step.get("v2"), label="coords-vectors.vtmv.v2"),
            )

        case "coords-vectors.vdist":
            return StepCoordsVectorsVdist(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vdist.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vdist.b"),
            )

        case "coords-vectors.vequ":
            return StepCoordsVectorsVequ(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.vequ.v"),
            )

        case "coords-vectors.vpack":
            return StepCoordsVectorsVpack(
                op=op,
                x=_expect_number(step.get("x"), label="coords-vectors.vpack.x"),
                y=_expect_number(step.get("y"), label="coords-vectors.vpack.y"),
                z=_expect_number(step.get("z"), label="coords-vectors.vpack.z"),
            )

        case "coords-vectors.vupack":
            return StepCoordsVectorsVupack(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.vupack.v"),
            )

        case "coords-vectors.vzero":
            return StepCoordsVectorsVzero(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.vzero.v"),
            )

        case "coords-vectors.unorm":
            return StepCoordsVectorsUnorm(
                op=op,
                v=_expect_vec3(step.get("v"), label="coords-vectors.unorm.v"),
            )

        case "coords-vectors.ucrss":
            return StepCoordsVectorsUcrss(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.ucrss.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.ucrss.b"),
            )

        case "coords-vectors.vsep":
            return StepCoordsVectorsVsep(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vsep.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vsep.b"),
            )

        case "coords-vectors.cyllat":
            return StepCoordsVectorsCyllat(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.cyllat.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.cyllat.lon"),
                z=_expect_number(step.get("z"), label="coords-vectors.cyllat.z"),
            )

        case "coords-vectors.cylrec":
            return StepCoordsVectorsCylrec(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.cylrec.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.cylrec.lon"),
                z=_expect_number(step.get("z"), label="coords-vectors.cylrec.z"),
            )

        case "coords-vectors.cylsph":
            return StepCoordsVectorsCylsph(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.cylsph.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.cylsph.lon"),
                z=_expect_number(step.get("z"), label="coords-vectors.cylsph.z"),
            )

        case "coords-vectors.latcyl":
            return StepCoordsVectorsLatcyl(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.latcyl.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.latcyl.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.latcyl.lat"),
            )

        case "coords-vectors.latsph":
            return StepCoordsVectorsLatsph(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.latsph.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.latsph.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.latsph.lat"),
            )

        case "coords-vectors.reccyl":
            return StepCoordsVectorsReccyl(
                op=op,
                rectan=_expect_vec3(step.get("rectan"), label="coords-vectors.reccyl.rectan"),
            )

        case "coords-vectors.sphcyl":
            return StepCoordsVectorsSphcyl(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.sphcyl.radius"),
                colat=_expect_number(step.get("colat"), label="coords-vectors.sphcyl.colat"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.sphcyl.lon"),
            )

        case "coords-vectors.sphlat":
            return StepCoordsVectorsSphlat(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.sphlat.radius"),
                colat=_expect_number(step.get("colat"), label="coords-vectors.sphlat.colat"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.sphlat.lon"),
            )

        case "coords-vectors.reclat":
            return StepCoordsVectorsReclat(
                op=op,
                rectan=_expect_vec3(step.get("rectan"), label="coords-vectors.reclat.rectan"),
            )

        case "coords-vectors.latrec":
            return StepCoordsVectorsLatrec(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.latrec.radius"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.latrec.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.latrec.lat"),
            )

        case "coords-vectors.recsph":
            return StepCoordsVectorsRecsph(
                op=op,
                rectan=_expect_vec3(step.get("rectan"), label="coords-vectors.recsph.rectan"),
            )

        case "coords-vectors.sphrec":
            return StepCoordsVectorsSphrec(
                op=op,
                radius=_expect_number(step.get("radius"), label="coords-vectors.sphrec.radius"),
                colat=_expect_number(step.get("colat"), label="coords-vectors.sphrec.colat"),
                lon=_expect_number(step.get("lon"), label="coords-vectors.sphrec.lon"),
            )

        case "coords-vectors.pi":
            return StepCoordsVectorsPi(op=op)

        case "coords-vectors.twopi":
            return StepCoordsVectorsTwopi(op=op)

        case "coords-vectors.halfpi":
            return StepCoordsVectorsHalfpi(op=op)

        case "coords-vectors.dpr":
            return StepCoordsVectorsDpr(op=op)

        case "coords-vectors.rpd":
            return StepCoordsVectorsRpd(op=op)

        case "coords-vectors.clight":
            return StepCoordsVectorsClight(op=op)

        case "coords-vectors.dpmax":
            return StepCoordsVectorsDpmax(op=op)

        case "coords-vectors.dpmin":
            return StepCoordsVectorsDpmin(op=op)

        case "coords-vectors.intmax":
            return StepCoordsVectorsIntmax(op=op)

        case "coords-vectors.intmin":
            return StepCoordsVectorsIntmin(op=op)

        case "coords-vectors.vnorm":
            return StepCoordsVectorsVnorm(op=op, v=_expect_vec3(step.get("v"), label="coords-vectors.vnorm.v"))

        case "coords-vectors.vhat":
            return StepCoordsVectorsVhat(op=op, v=_expect_vec3(step.get("v"), label="coords-vectors.vhat.v"))

        case "coords-vectors.vdot":
            return StepCoordsVectorsVdot(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vdot.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vdot.b"),
            )

        case "coords-vectors.vcrss":
            return StepCoordsVectorsVcrss(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vcrss.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vcrss.b"),
            )

        case "coords-vectors.vadd":
            return StepCoordsVectorsVadd(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vadd.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vadd.b"),
            )

        case "coords-vectors.vsub":
            return StepCoordsVectorsVsub(
                op=op,
                a=_expect_vec3(step.get("a"), label="coords-vectors.vsub.a"),
                b=_expect_vec3(step.get("b"), label="coords-vectors.vsub.b"),
            )

        case "coords-vectors.vminus":
            return StepCoordsVectorsVminus(op=op, v=_expect_vec3(step.get("v"), label="coords-vectors.vminus.v"))

        case "coords-vectors.vscl":
            return StepCoordsVectorsVscl(
                op=op,
                s=_expect_number(step.get("s"), label="coords-vectors.vscl.s"),
                v=_expect_vec3(step.get("v"), label="coords-vectors.vscl.v"),
            )

        case "coords-vectors.mxm":
            return StepCoordsVectorsMxm(
                op=op,
                m1=_expect_3x3_matrix(step.get("m1"), label="coords-vectors.mxm.m1"),
                m2=_expect_3x3_matrix(step.get("m2"), label="coords-vectors.mxm.m2"),
            )

        case "coords-vectors.rotate":
            return StepCoordsVectorsRotate(
                op=op,
                angle=_expect_number(step.get("angle"), label="coords-vectors.rotate.angle"),
                axis=_expect_int(step.get("axis"), label="coords-vectors.rotate.axis"),
            )

        case "coords-vectors.rotmat":
            return StepCoordsVectorsRotmat(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.rotmat.m"),
                angle=_expect_number(step.get("angle"), label="coords-vectors.rotmat.angle"),
                axis=_expect_int(step.get("axis"), label="coords-vectors.rotmat.axis"),
            )

        case "coords-vectors.axisar":
            return StepCoordsVectorsAxisar(
                op=op,
                axis=_expect_vec3(step.get("axis"), label="coords-vectors.axisar.axis"),
                angle=_expect_number(step.get("angle"), label="coords-vectors.axisar.angle"),
            )

        case "coords-vectors.georec":
            return StepCoordsVectorsGeorec(
                op=op,
                lon=_expect_number(step.get("lon"), label="coords-vectors.georec.lon"),
                lat=_expect_number(step.get("lat"), label="coords-vectors.georec.lat"),
                alt=_expect_number(step.get("alt"), label="coords-vectors.georec.alt"),
                re=_expect_number(step.get("re"), label="coords-vectors.georec.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.georec.f"),
            )

        case "coords-vectors.recgeo":
            return StepCoordsVectorsRecgeo(
                op=op,
                rectan=_expect_vec3(step.get("rectan"), label="coords-vectors.recgeo.rectan"),
                re=_expect_number(step.get("re"), label="coords-vectors.recgeo.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.recgeo.f"),
            )

        case "coords-vectors.mxv":
            return StepCoordsVectorsMxv(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.mxv.m"),
                v=_expect_vec3(step.get("v"), label="coords-vectors.mxv.v"),
            )

        case "coords-vectors.mtxv":
            return StepCoordsVectorsMtxv(
                op=op,
                m=_expect_3x3_matrix(step.get("m"), label="coords-vectors.mtxv.m"),
                v=_expect_vec3(step.get("v"), label="coords-vectors.mtxv.v"),
            )

        case "cells-windows.card":
            return StepCellsWindowsCard(
                op=op,
                targetKind=_expect_string(step.get("targetKind"), label="cells-windows.card.targetKind"),
                targetId=_expect_string(step.get("targetId"), label="cells-windows.card.targetId"),
            )

        case "cells-windows.appndc":
            return StepCellsWindowsAppndc(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.appndc.cellId"),
                item=_expect_string(step.get("item"), label="cells-windows.appndc.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.appndc.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label="cells-windows.appndc.length") if "length" in step else None,
            )

        case "cells-windows.appndd":
            return StepCellsWindowsAppndd(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.appndd.cellId"),
                item=_expect_number(step.get("item"), label="cells-windows.appndd.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.appndd.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.appndi":
            return StepCellsWindowsAppndi(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.appndi.cellId"),
                item=_expect_int(step.get("item"), label="cells-windows.appndi.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.appndi.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.diff" | "cells-windows.inter" | "cells-windows.sdiff" | "cells-windows.union":
            kind = step.get("kind")
            if kind not in ("char", "double", "int"):
                raise ValueError("Expected an ordinary set kind")
            return StepCellsWindowsSetResult(
                op=op,
                kind=kind,
                aId=_expect_string(step.get("aId"), label=f"{op}.aId"),
                bId=_expect_string(step.get("bId"), label=f"{op}.bId"),
                resultId=_expect_string(step.get("resultId"), label=f"{op}.resultId"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label=f"{op}.length") if "length" in step else None,
            )

        case "cells-windows.set":
            kind = step.get("kind")
            if kind not in ("char", "double", "int"):
                raise ValueError("Expected an ordinary set kind")
            return StepCellsWindowsSet(
                op=op,
                kind=kind,
                aId=_expect_string(step.get("aId"), label=f"{op}.aId"),
                relation=_expect_string(step.get("relation"), label=f"{op}.relation"),
                bId=_expect_string(step.get("bId"), label=f"{op}.bId"),
            )

        case "cells-windows.removc":
            return StepCellsWindowsRemovc(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_string(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label=f"{op}.length") if "length" in step else None,
            )

        case "cells-windows.removd":
            return StepCellsWindowsRemovd(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_number(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.removi":
            return StepCellsWindowsRemovi(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_int(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.ordc":
            return StepCellsWindowsOrdc(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_string(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label=f"{op}.length") if "length" in step else None,
            )

        case "cells-windows.ordd":
            return StepCellsWindowsOrdd(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_number(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.ordi":
            return StepCellsWindowsOrdi(
                op=op,
                cellId=_expect_string(step.get("cellId"), label=f"{op}.cellId"),
                item=_expect_int(step.get("item"), label=f"{op}.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label=f"{op}.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.copy":
            kind = step.get("kind")
            if kind not in ("char", "double", "int"):
                raise ValueError("copy requires an ordinary cell kind")
            return StepCellsWindowsCopy(
                op=op,
                kind=kind,
                sourceId=_expect_string(step.get("sourceId"), label="cells-windows.copy.sourceId"),
                resultId=_expect_string(step.get("resultId"), label="cells-windows.copy.resultId"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.copy.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label="cells-windows.copy.length") if "length" in step else None,
            )

        case "cells-windows.elemc":
            return StepCellsWindowsElemc(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.elemc.cellId"),
                item=_expect_string(step.get("item"), label="cells-windows.elemc.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.elemc.maxCardinality") if "maxCardinality" in step else None,
                length=_expect_int(step.get("length"), label="cells-windows.elemc.length") if "length" in step else None,
            )

        case "cells-windows.elemd":
            return StepCellsWindowsElemd(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.elemd.cellId"),
                item=_expect_number(step.get("item"), label="cells-windows.elemd.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.elemd.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.elemi":
            return StepCellsWindowsElemi(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.elemi.cellId"),
                item=_expect_int(step.get("item"), label="cells-windows.elemi.item"),
                maxCardinality=_expect_int(step.get("maxCardinality"), label="cells-windows.elemi.maxCardinality") if "maxCardinality" in step else None,
            )

        case "cells-windows.lparss":
            return StepCellsWindowsLparss(
                op=op, cellId=_expect_string(step.get("cellId"), label="lparss.cellId"),
                list=_expect_string(step.get("list"), label="lparss.list"),
                delims=_expect_string(step.get("delims"), label="lparss.delims"),
                maxCardinality=_expect_int(step.get("maxCardinality", 8), label="lparss.maxCardinality"),
                length=_expect_int(step.get("length", 32), label="lparss.length"),
            )

        case "cells-windows.insrtc":
            max_cardinality_raw = step.get("maxCardinality")
            max_cardinality = None
            if max_cardinality_raw is not None:
                max_cardinality = _expect_int(
                    max_cardinality_raw,
                    label="cells-windows.insrtc.maxCardinality",
                )

            length_raw = step.get("length")
            length = None
            if length_raw is not None:
                length = _expect_int(length_raw, label="cells-windows.insrtc.length")

            return StepCellsWindowsInsrtc(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.insrtc.cellId"),
                item=_expect_string(step.get("item"), label="cells-windows.insrtc.item"),
                maxCardinality=max_cardinality,
                length=length,
            )

        case "cells-windows.insrtd":
            max_cardinality_raw = step.get("maxCardinality")
            max_cardinality = None
            if max_cardinality_raw is not None:
                max_cardinality = _expect_int(
                    max_cardinality_raw,
                    label="cells-windows.insrtd.maxCardinality",
                )

            return StepCellsWindowsInsrtd(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.insrtd.cellId"),
                item=_expect_number(step.get("item"), label="cells-windows.insrtd.item"),
                maxCardinality=max_cardinality,
            )

        case "cells-windows.insrti":
            max_cardinality_raw = step.get("maxCardinality")
            max_cardinality = None
            if max_cardinality_raw is not None:
                max_cardinality = _expect_int(
                    max_cardinality_raw,
                    label="cells-windows.insrti.maxCardinality",
                )

            return StepCellsWindowsInsrti(
                op=op,
                cellId=_expect_string(step.get("cellId"), label="cells-windows.insrti.cellId"),
                item=_expect_int(step.get("item"), label="cells-windows.insrti.item"),
                maxCardinality=max_cardinality,
            )

        case "cells-windows.scard":
            return StepCellsWindowsScard(
                op=op,
                card=_expect_int(step.get("card"), label="cells-windows.scard.card"),
                targetKind=_expect_string(step.get("targetKind"), label="cells-windows.scard.targetKind"),
                targetId=_expect_string(step.get("targetId"), label="cells-windows.scard.targetId"),
            )

        case "cells-windows.size":
            return StepCellsWindowsSize(
                op=op,
                targetKind=_expect_string(step.get("targetKind"), label="cells-windows.size.targetKind"),
                targetId=_expect_string(step.get("targetId"), label="cells-windows.size.targetId"),
            )

        case "cells-windows.ssize":
            return StepCellsWindowsSsize(
                op=op,
                size=_expect_int(step.get("size"), label="cells-windows.ssize.size"),
                targetKind=_expect_string(step.get("targetKind"), label="cells-windows.ssize.targetKind"),
                targetId=_expect_string(step.get("targetId"), label="cells-windows.ssize.targetId"),
            )

        case "cells-windows.valid":
            return StepCellsWindowsValid(
                op=op,
                size=_expect_int(step.get("size"), label="cells-windows.valid.size"),
                n=_expect_int(step.get("n"), label="cells-windows.valid.n"),
                targetKind=_expect_string(step.get("targetKind"), label="cells-windows.valid.targetKind"),
                targetId=_expect_string(step.get("targetId"), label="cells-windows.valid.targetId"),
            )

        case "cells-windows.wncard":
            return StepCellsWindowsWncard(
                op=op,
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wncard.windowId"),
            )

        case "cells-windows.wninsd":
            max_intervals_raw = step.get("maxIntervals")
            max_intervals = None
            if max_intervals_raw is not None:
                max_intervals = _expect_int(max_intervals_raw, label="cells-windows.wninsd.maxIntervals")
            return StepCellsWindowsWninsd(
                op=op,
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wninsd.windowId"),
                left=_expect_number(step.get("left"), label="cells-windows.wninsd.left"),
                right=_expect_number(step.get("right"), label="cells-windows.wninsd.right"),
                maxIntervals=max_intervals,
            )

        case "cells-windows.wnfetd":
            return StepCellsWindowsWnfetd(
                op=op,
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnfetd.windowId"),
                index=_expect_int(step.get("index"), label="cells-windows.wnfetd.index"),
            )

        case "cells-windows.wncomd":
            return StepCellsWindowsWncomd(
                op=op,
                left=_expect_number(step.get("left"), label="cells-windows.wncomd.left"),
                right=_expect_number(step.get("right"), label="cells-windows.wncomd.right"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wncomd.windowId"),
                resultId=_expect_string(step.get("resultId"), label="cells-windows.wncomd.resultId"),
                maxIntervals=_expect_int(step.get("maxIntervals"), label="cells-windows.wncomd.maxIntervals"),
            )

        case "cells-windows.wncond":
            return StepCellsWindowsWncond(
                op=op,
                left=_expect_number(step.get("left"), label="cells-windows.wncond.left"),
                right=_expect_number(step.get("right"), label="cells-windows.wncond.right"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wncond.windowId"),
            )

        case "cells-windows.wndifd":
            return StepCellsWindowsWndifd(
                op=op,
                aId=_expect_string(step.get("aId"), label="cells-windows.wndifd.aId"),
                bId=_expect_string(step.get("bId"), label="cells-windows.wndifd.bId"),
                resultId=_expect_string(step.get("resultId"), label="cells-windows.wndifd.resultId"),
                maxIntervals=_expect_int(step.get("maxIntervals"), label="cells-windows.wndifd.maxIntervals"),
            )

        case "cells-windows.wnelmd":
            return StepCellsWindowsWnelmd(
                op=op,
                point=_expect_number(step.get("point"), label="cells-windows.wnelmd.point"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnelmd.windowId"),
            )

        case "cells-windows.wnexpd":
            return StepCellsWindowsWnexpd(
                op=op,
                left=_expect_number(step.get("left"), label="cells-windows.wnexpd.left"),
                right=_expect_number(step.get("right"), label="cells-windows.wnexpd.right"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnexpd.windowId"),
            )

        case "cells-windows.wnextd":
            return StepCellsWindowsWnextd(
                op=op,
                side=_expect_string(step.get("side"), label="cells-windows.wnextd.side"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnextd.windowId"),
            )

        case "cells-windows.wnfild":
            return StepCellsWindowsWnfild(
                op=op,
                small=_expect_number(step.get("small"), label="cells-windows.wnfild.small"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnfild.windowId"),
            )

        case "cells-windows.wnfltd":
            return StepCellsWindowsWnfltd(
                op=op,
                small=_expect_number(step.get("small"), label="cells-windows.wnfltd.small"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnfltd.windowId"),
            )

        case "cells-windows.wnincd":
            return StepCellsWindowsWnincd(
                op=op,
                left=_expect_number(step.get("left"), label="cells-windows.wnincd.left"),
                right=_expect_number(step.get("right"), label="cells-windows.wnincd.right"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnincd.windowId"),
            )

        case "cells-windows.wnintd":
            return StepCellsWindowsWnintd(
                op=op,
                aId=_expect_string(step.get("aId"), label="cells-windows.wnintd.aId"),
                bId=_expect_string(step.get("bId"), label="cells-windows.wnintd.bId"),
                resultId=_expect_string(step.get("resultId"), label="cells-windows.wnintd.resultId"),
                maxIntervals=_expect_int(step.get("maxIntervals"), label="cells-windows.wnintd.maxIntervals"),
            )

        case "cells-windows.wnreld":
            return StepCellsWindowsWnreld(
                op=op,
                aId=_expect_string(step.get("aId"), label="cells-windows.wnreld.aId"),
                relation=_expect_string(step.get("relation"), label="cells-windows.wnreld.relation"),
                bId=_expect_string(step.get("bId"), label="cells-windows.wnreld.bId"),
            )

        case "cells-windows.wnsumd":
            return StepCellsWindowsWnsumd(
                op=op,
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnsumd.windowId"),
            )

        case "cells-windows.wnunid":
            return StepCellsWindowsWnunid(
                op=op,
                aId=_expect_string(step.get("aId"), label="cells-windows.wnunid.aId"),
                bId=_expect_string(step.get("bId"), label="cells-windows.wnunid.bId"),
                resultId=_expect_string(step.get("resultId"), label="cells-windows.wnunid.resultId"),
                maxIntervals=_expect_int(step.get("maxIntervals"), label="cells-windows.wnunid.maxIntervals"),
            )

        case "cells-windows.wnvald":
            return StepCellsWindowsWnvald(
                op=op,
                size=_expect_int(step.get("size"), label="cells-windows.wnvald.size"),
                n=_expect_int(step.get("n"), label="cells-windows.wnvald.n"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnvald.windowId"),
            )

        case "kernel-pool.badkpv":
            return StepKernelPoolBadkpv(
                op=op,
                caller=_expect_string(step.get("caller"), label="kernel-pool.badkpv.caller"),
                name=_expect_string(step.get("name"), label="kernel-pool.badkpv.name"),
                comp=_expect_string(step.get("comp"), label="kernel-pool.badkpv.comp"),
                size=_expect_int(step.get("size"), label="kernel-pool.badkpv.size"),
                divby=_expect_int(step.get("divby"), label="kernel-pool.badkpv.divby"),
                type=_expect_string(step.get("type"), label="kernel-pool.badkpv.type"),
            )
        case "kernel-pool.bodvcd":
            return StepKernelPoolBodvcd(
                op=op,
                body=_expect_int(step.get("body"), label="kernel-pool.bodvcd.body"),
                item=_expect_string(step.get("item"), label="kernel-pool.bodvcd.item"),
                maxn=_expect_int(step.get("maxn"), label="kernel-pool.bodvcd.maxn"),
            )
        case "kernel-pool.bodvrd":
            return StepKernelPoolBodvrd(
                op=op,
                body=_expect_string(step.get("body"), label="kernel-pool.bodvrd.body"),
                item=_expect_string(step.get("item"), label="kernel-pool.bodvrd.item"),
                maxn=_expect_int(step.get("maxn"), label="kernel-pool.bodvrd.maxn"),
            )
        case "kernel-pool.clpool":
            return StepKernelPoolClpool(op=op)
        case "kernel-pool.dvpool":
            return StepKernelPoolDvpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.dvpool.name"),
            )
        case "kernel-pool.ldpool":
            return StepKernelPoolLdpool(
                op=op,
                file=_decode_path_ref(step.get("file"), label="kernel-pool.ldpool.file"),
            )
        case "kernel-pool.lmpool":
            return StepKernelPoolLmpool(
                op=op,
                lines=_expect_string_list(step.get("lines"), label="kernel-pool.lmpool.lines"),
            )
        case "kernel-pool.stpool":
            return StepKernelPoolStpool(
                op=op,
                item=_expect_string(step.get("item"), label="kernel-pool.stpool.item"),
                nth=_expect_int(step.get("nth"), label="kernel-pool.stpool.nth"),
                contin=_expect_string(step.get("contin"), label="kernel-pool.stpool.contin"),
                lenout=_expect_int(step.get("lenout"), label="kernel-pool.stpool.lenout"),
            )
        case "kernel-pool.szpool":
            return StepKernelPoolSzpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.szpool.name"),
            )
        case "kernel-pool.gdpool":
            return StepKernelPoolGdpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.gdpool.name"),
                start=_expect_int(step.get("start"), label="kernel-pool.gdpool.start"),
                room=_expect_int(step.get("room"), label="kernel-pool.gdpool.room"),
            )

        case "kernel-pool.gipool":
            return StepKernelPoolGipool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.gipool.name"),
                start=_expect_int(step.get("start"), label="kernel-pool.gipool.start"),
                room=_expect_int(step.get("room"), label="kernel-pool.gipool.room"),
            )

        case "kernel-pool.gcpool":
            return StepKernelPoolGcpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.gcpool.name"),
                start=_expect_int(step.get("start"), label="kernel-pool.gcpool.start"),
                room=_expect_int(step.get("room"), label="kernel-pool.gcpool.room"),
            )

        case "kernel-pool.gnpool":
            return StepKernelPoolGnpool(
                op=op,
                template=_expect_string(step.get("template"), label="kernel-pool.gnpool.template"),
                start=_expect_int(step.get("start"), label="kernel-pool.gnpool.start"),
                room=_expect_int(step.get("room"), label="kernel-pool.gnpool.room"),
            )

        case "kernel-pool.dtpool":
            return StepKernelPoolDtpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.dtpool.name"),
            )

        case "kernel-pool.pdpool":
            return StepKernelPoolPdpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.pdpool.name"),
                values=_expect_number_list(step.get("values"), label="kernel-pool.pdpool.values"),
            )

        case "kernel-pool.pipool":
            return StepKernelPoolPipool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.pipool.name"),
                values=_expect_int_list(step.get("values"), label="kernel-pool.pipool.values"),
            )

        case "kernel-pool.pcpool":
            return StepKernelPoolPcpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.pcpool.name"),
                values=_expect_string_list(step.get("values"), label="kernel-pool.pcpool.values"),
            )

        case "kernel-pool.swpool":
            return StepKernelPoolSwpool(
                op=op,
                agent=_expect_string(step.get("agent"), label="kernel-pool.swpool.agent"),
                names=_expect_string_list(step.get("names"), label="kernel-pool.swpool.names"),
            )

        case "kernel-pool.cvpool":
            return StepKernelPoolCvpool(
                op=op,
                agent=_expect_string(step.get("agent"), label="kernel-pool.cvpool.agent"),
            )

        case "kernel-pool.expool":
            return StepKernelPoolExpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.expool.name"),
            )

        case "kernels.furnsh":
            return StepKernelsFurnsh(op=op, file=_decode_path_ref(step.get("file"), label="kernels.furnsh.file"))

        case "kernels.kclear":
            return StepKernelsKclear(op=op)

        case "kernels.kinfo":
            return StepKernelsKinfo(op=op, path=_expect_string(step.get("path"), label="kernels.kinfo.path"))

        case "kernels.kplfrm":
            return StepKernelsKplfrm(op=op, frmcls=_expect_int(step.get("frmcls"), label="kernels.kplfrm.frmcls"), capacity=_expect_int(step.get("capacity", 1024), label="kernels.kplfrm.capacity"))

        case "kernels.ktotal":
            return StepKernelsKtotal(op=op, kind=step.get("kind"))

        case "kernels.kdata":
            return StepKernelsKdata(
                op=op,
                which=_expect_int(step.get("which"), label="kernels.kdata.which"),
                kind=step.get("kind"),
            )

        case "kernels.kxtrct":
            return StepKernelsKxtrct(
                op=op,
                keywd=_expect_string(step.get("keywd"), label="kernels.kxtrct.keywd"),
                terms=_expect_string_list(step.get("terms"), label="kernels.kxtrct.terms"),
                string=_expect_string(step.get("string"), label="kernels.kxtrct.string"),
            )

        case "kernels.unload":
            return StepKernelsUnload(op=op, path=_expect_string(step.get("path"), label="kernels.unload.path"))

        case "ephemeris.spkcls":
            return StepEphemerisSpkcls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ephemeris.spkcls.handleId"),
                captureError=_expect_bool(step.get("captureError",False),label="ephemeris.spkcls.captureError"),
            )

        case "ephemeris.spkcov":
            max_intervals_raw = step.get("maxIntervals")
            max_intervals = None
            if max_intervals_raw is not None:
                max_intervals = _expect_int(max_intervals_raw, label="ephemeris.spkcov.maxIntervals")
            return StepEphemerisSpkcov(
                op=op,
                spk=_decode_path_ref(step.get("spk"), label="ephemeris.spkcov.spk"),
                idcode=_expect_int(step.get("idcode"), label="ephemeris.spkcov.idcode"),
                coverWindowId=_expect_string(step.get("coverWindowId"), label="ephemeris.spkcov.coverWindowId"),
                maxIntervals=max_intervals,
            )

        case "ephemeris.spkez":
            return StepEphemerisSpkez(
                op=op,
                target=_expect_int(step.get("target"), label="ephemeris.spkez.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkez.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkez.ref"),
                abcorr=_expect_string(step.get("abcorr"), label="ephemeris.spkez.abcorr"),
                observer=_expect_int(step.get("observer"), label="ephemeris.spkez.observer"),
            )

        case "ephemeris.spkezp":
            return StepEphemerisSpkezp(
                op=op,
                target=_expect_int(step.get("target"), label="ephemeris.spkezp.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkezp.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkezp.ref"),
                abcorr=_expect_string(step.get("abcorr"), label="ephemeris.spkezp.abcorr"),
                observer=_expect_int(step.get("observer"), label="ephemeris.spkezp.observer"),
            )

        case "ephemeris.spkezr":
            return StepEphemerisSpkezr(
                op=op,
                target=_expect_string(step.get("target"), label="ephemeris.spkezr.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkezr.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkezr.ref"),
                abcorr=_expect_string(step.get("abcorr"), label="ephemeris.spkezr.abcorr"),
                observer=_expect_string(step.get("observer"), label="ephemeris.spkezr.observer"),
            )

        case "ephemeris.conics":
            return StepEphemerisConics(
                op=op,
                elts=_orbital_vector(step.get("elts"), length=8, label="ephemeris.conics.elts"),
                et=_orbital_number(step.get("et"), label="ephemeris.conics.et"),
            )

        case "ephemeris.eqncpv":
            return StepEphemerisEqncpv(
                op=op,
                et=_orbital_number(step.get("et"), label="ephemeris.eqncpv.et"),
                epoch=_orbital_number(step.get("epoch"), label="ephemeris.eqncpv.epoch"),
                eqel=_orbital_vector(step.get("eqel"), length=9, label="ephemeris.eqncpv.eqel"),
                rapol=_orbital_number(step.get("rapol"), label="ephemeris.eqncpv.rapol"),
                decpol=_orbital_number(step.get("decpol"), label="ephemeris.eqncpv.decpol"),
            )

        case "ephemeris.oscelt":
            return StepEphemerisOscelt(
                op=op,
                state=_orbital_vector(step.get("state"), length=6, label="ephemeris.oscelt.state"),
                et=_orbital_number(step.get("et"), label="ephemeris.oscelt.et"),
                mu=_orbital_number(step.get("mu"), label="ephemeris.oscelt.mu"),
            )

        case "ephemeris.oscltx":
            return StepEphemerisOscltx(
                op=op,
                state=_orbital_vector(step.get("state"), length=6, label="ephemeris.oscltx.state"),
                et=_orbital_number(step.get("et"), label="ephemeris.oscltx.et"),
                mu=_orbital_number(step.get("mu"), label="ephemeris.oscltx.mu"),
            )

        case "ephemeris.prop2b":
            return StepEphemerisProp2b(
                op=op,
                gm=_orbital_number(step.get("gm"), label="ephemeris.prop2b.gm"),
                pvinit=_orbital_vector(step.get("pvinit"), length=6, label="ephemeris.prop2b.pvinit"),
                dt=_orbital_number(step.get("dt"), label="ephemeris.prop2b.dt"),
            )

        case "ephemeris.getelm":
            return StepEphemerisGetelm(
                op, _expect_int(step.get("firstYear"), label="getelm.firstYear"),
                _expect_string_list(step.get("lines"), label="getelm.lines"),
                _expect_bool(step.get("captureError", False), label="getelm.captureError"),
            )
        case "ephemeris.evsgp4":
            return StepEphemerisEvsgp4(
                op, _expect_number(step.get("et"), label="evsgp4.et"),
                _expect_number_list(step.get("geophs"), label="evsgp4.geophs"),
                _expect_number_list(step.get("elems"), label="evsgp4.elems"),
                _expect_bool(step.get("captureError", False), label="evsgp4.captureError"),
            )
        case "ephemeris.spkgeo":
            return StepEphemerisSpkgeo(
                op=op,
                target=_expect_int(step.get("target"), label="ephemeris.spkgeo.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkgeo.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkgeo.ref"),
                observer=_expect_int(step.get("observer"), label="ephemeris.spkgeo.observer"),
            )

        case "ephemeris.spkgps":
            return StepEphemerisSpkgps(
                op=op,
                target=_expect_int(step.get("target"), label="ephemeris.spkgps.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkgps.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkgps.ref"),
                observer=_expect_int(step.get("observer"), label="ephemeris.spkgps.observer"),
            )

        case "ephemeris.spkobj":
            max_cardinality_raw = step.get("maxCardinality")
            max_cardinality = None
            if max_cardinality_raw is not None:
                max_cardinality = _expect_int(max_cardinality_raw, label="ephemeris.spkobj.maxCardinality")
            return StepEphemerisSpkobj(
                op=op,
                spk=_decode_path_ref(step.get("spk"), label="ephemeris.spkobj.spk"),
                idsCellId=_expect_string(step.get("idsCellId"), label="ephemeris.spkobj.idsCellId"),
                maxCardinality=max_cardinality,
            )

        case "ephemeris.spkopa":
            return StepEphemerisSpkopa(
                op=op,
                file=_decode_path_ref(step.get("file"), label="ephemeris.spkopa.file"),
                handleId=_expect_string(step.get("handleId"), label="ephemeris.spkopa.handleId"),
            )

        case "ephemeris.spkopn":
            return StepEphemerisSpkopn(
                op=op,
                file=_decode_path_ref(step.get("file"), label="ephemeris.spkopn.file"),
                ifname=_expect_string(step.get("ifname"), label="ephemeris.spkopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="ephemeris.spkopn.ncomch"),
                handleId=_expect_string(step.get("handleId"), label="ephemeris.spkopn.handleId"),
            )

        case "ephemeris.spkpds":
            return StepEphemerisSpkpds(
                op=op,
                body=_expect_int(step.get("body"), label="ephemeris.spkpds.body"),
                center=_expect_int(step.get("center"), label="ephemeris.spkpds.center"),
                frame=_expect_string(step.get("frame"), label="ephemeris.spkpds.frame"),
                type=_expect_int(step.get("type"), label="ephemeris.spkpds.type"),
                first=_expect_number(step.get("first"), label="ephemeris.spkpds.first"),
                last=_expect_number(step.get("last"), label="ephemeris.spkpds.last"),
                descrId=None if step.get("descrId") is None else _expect_string(step["descrId"],label="ephemeris.spkpds.descrId"),
            )

        case "ephemeris.spkpos":
            return StepEphemerisSpkpos(
                op=op,
                target=_expect_string(step.get("target"), label="ephemeris.spkpos.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkpos.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkpos.ref"),
                abcorr=_expect_string(step.get("abcorr"), label="ephemeris.spkpos.abcorr"),
                observer=_expect_string(step.get("observer"), label="ephemeris.spkpos.observer"),
            )

        case "ephemeris.spksfs":
            return StepEphemerisSpksfs(
                op=op,
                body=_expect_int(step.get("body"), label="ephemeris.spksfs.body"),
                descrId=None if step.get("descrId") is None else _expect_string(step["descrId"],label="ephemeris.spksfs.descrId"),
                et=_expect_number(step.get("et"), label="ephemeris.spksfs.et"),
            )

        case "ephemeris.spkssb":
            return StepEphemerisSpkssb(
                op=op,
                target=_expect_int(step.get("target"), label="ephemeris.spkssb.target"),
                et=_expect_number(step.get("et"), label="ephemeris.spkssb.et"),
                ref=_expect_string(step.get("ref"), label="ephemeris.spkssb.ref"),
            )

        case "ephemeris.spkuds":
            if ("descr" in step) == ("descrId" in step):
                raise ValueError("ephemeris.spkuds requires exactly one of descr or descrId")
            return StepEphemerisSpkuds(
                op=op,
                descr=None if "descr" not in step else _expect_spk_packed_descriptor(step["descr"], label="ephemeris.spkuds.descr"),
                descrId=None if "descrId" not in step else _expect_string(step["descrId"],label="ephemeris.spkuds.descrId"),
            )

        case "ephemeris.spkw02":
            return StepEphemerisSpkw02(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw02.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw02.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw02.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw02.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw02.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw02.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw02.segid"),
                intlen=_expect_number(step.get("intlen"),label="ephemeris.spkw02.intlen"),
                n=_expect_int(step.get("n"),label="ephemeris.spkw02.n"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw02.degree"),
                cdata=_expect_number_list(step.get("cdata"),label="ephemeris.spkw02.cdata"),
                btime=_expect_number(step.get("btime"),label="ephemeris.spkw02.btime"),
            )
        case "ephemeris.spkw03":
            return StepEphemerisSpkw03(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw03.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw03.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw03.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw03.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw03.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw03.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw03.segid"),
                intlen=_expect_number(step.get("intlen"),label="ephemeris.spkw03.intlen"),
                n=_expect_int(step.get("n"),label="ephemeris.spkw03.n"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw03.degree"),
                cdata=_expect_number_list(step.get("cdata"),label="ephemeris.spkw03.cdata"),
                btime=_expect_number(step.get("btime"),label="ephemeris.spkw03.btime"),
            )
        case "ephemeris.spkw20":
            return StepEphemerisSpkw20(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw20.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw20.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw20.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw20.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw20.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw20.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw20.segid"),
                intlen=_expect_number(step.get("intlen"),label="ephemeris.spkw20.intlen"),
                n=_expect_int(step.get("n"),label="ephemeris.spkw20.n"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw20.degree"),
                cdata=_expect_number_list(step.get("cdata"),label="ephemeris.spkw20.cdata"),
                dscale=_expect_number(step.get("dscale"),label="ephemeris.spkw20.dscale"),
                tscale=_expect_number(step.get("tscale"),label="ephemeris.spkw20.tscale"),
                initjd=_expect_number(step.get("initjd"),label="ephemeris.spkw20.initjd"),
                initfr=_expect_number(step.get("initfr"),label="ephemeris.spkw20.initfr"),
            )
        case "ephemeris.spkw09":
            return StepEphemerisSpkw09(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw09.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw09.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw09.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw09.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw09.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw09.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw09.segid"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw09.degree"),
                states=_expect_number_list(step.get("states"),label="ephemeris.spkw09.states"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spkw09.epochs"),
            )
        case "ephemeris.spkw12":
            return StepEphemerisSpkw12(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw12.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw12.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw12.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw12.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw12.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw12.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw12.segid"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw12.degree"),
                states=_expect_number_list(step.get("states"),label="ephemeris.spkw12.states"),
                epoch0=_expect_number(step.get("epoch0"),label="ephemeris.spkw12.epoch0"),
                step=_expect_number(step.get("step"),label="ephemeris.spkw12.step"),
            )
        case "ephemeris.spkw13":
            return StepEphemerisSpkw13(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw13.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw13.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw13.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw13.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw13.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw13.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw13.segid"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw13.degree"),
                states=_expect_number_list(step.get("states"),label="ephemeris.spkw13.states"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spkw13.epochs"),
            )
        case "ephemeris.spkw18":
            return StepEphemerisSpkw18(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw18.handleId"),
                subtype=_expect_int(step.get("subtype"),label="ephemeris.spkw18.subtype"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw18.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw18.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw18.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw18.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw18.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw18.segid"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spkw18.degree"),
                packets=_expect_number_list(step.get("packets"),label="ephemeris.spkw18.packets"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spkw18.epochs"),
            )
        case "ephemeris.spkw05":
            return StepEphemerisSpkw05(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw05.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw05.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw05.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw05.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw05.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw05.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw05.segid"),
                gm=_expect_number(step.get("gm"),label="ephemeris.spkw05.gm"),
                states=_expect_number_list(step.get("states"),label="ephemeris.spkw05.states"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spkw05.epochs"),
            )
        case "ephemeris.spkw10":
            return StepEphemerisSpkw10(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw10.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw10.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw10.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw10.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw10.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw10.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw10.segid"),
                consts=_expect_number_list(step.get("consts"),label="ephemeris.spkw10.consts"),
                elems=_expect_number_list(step.get("elems"),label="ephemeris.spkw10.elems"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spkw10.epochs"),
            )
        case "ephemeris.spkw15":
            return StepEphemerisSpkw15(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw15.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw15.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw15.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw15.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw15.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw15.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw15.segid"),
                epoch=_expect_number(step.get("epoch"),label="ephemeris.spkw15.epoch"),
                tp=_expect_vec3(step.get("tp"),label="ephemeris.spkw15.tp"),
                pa=_expect_vec3(step.get("pa"),label="ephemeris.spkw15.pa"),
                p=_expect_number(step.get("p"),label="ephemeris.spkw15.p"),
                ecc=_expect_number(step.get("ecc"),label="ephemeris.spkw15.ecc"),
                j2flg=_expect_number(step.get("j2flg"),label="ephemeris.spkw15.j2flg"),
                pv=_expect_vec3(step.get("pv"),label="ephemeris.spkw15.pv"),
                gm=_expect_number(step.get("gm"),label="ephemeris.spkw15.gm"),
                j2=_expect_number(step.get("j2"),label="ephemeris.spkw15.j2"),
                radius=_expect_number(step.get("radius"),label="ephemeris.spkw15.radius"),
            )
        case "ephemeris.spkw17":
            return StepEphemerisSpkw17(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spkw17.handleId"),
                body=_expect_int(step.get("body"),label="ephemeris.spkw17.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spkw17.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spkw17.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spkw17.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spkw17.last"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spkw17.segid"),
                epoch=_expect_number(step.get("epoch"),label="ephemeris.spkw17.epoch"),
                eqel=_expect_number_list(step.get("eqel"),label="ephemeris.spkw17.eqel"),
                rapol=_expect_number(step.get("rapol"),label="ephemeris.spkw17.rapol"),
                decpol=_expect_number(step.get("decpol"),label="ephemeris.spkw17.decpol"),
            )
        case "ephemeris.spk14b":
            return StepEphemerisSpk14b(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spk14b.handleId"),
                segid=_expect_string(step.get("segid"),label="ephemeris.spk14b.segid"),
                body=_expect_int(step.get("body"),label="ephemeris.spk14b.body"),
                center=_expect_int(step.get("center"),label="ephemeris.spk14b.center"),
                frame=_expect_string(step.get("frame"),label="ephemeris.spk14b.frame"),
                first=_expect_number(step.get("first"),label="ephemeris.spk14b.first"),
                last=_expect_number(step.get("last"),label="ephemeris.spk14b.last"),
                degree=_expect_int(step.get("degree"),label="ephemeris.spk14b.degree"),
            )
        case "ephemeris.spk14a":
            return StepEphemerisSpk14a(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spk14a.handleId"),
                count=_expect_int(step.get("count"),label="ephemeris.spk14a.count"),
                records=_expect_number_list(step.get("records"),label="ephemeris.spk14a.records"),
                epochs=_expect_number_list(step.get("epochs"),label="ephemeris.spk14a.epochs"),
            )
        case "ephemeris.spk14e":
            return StepEphemerisSpk14e(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="ephemeris.spk14e.handleId"),
            )
        case "ephemeris.spkw08":
            return StepEphemerisSpkw08(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ephemeris.spkw08.handleId"),
                body=_expect_int(step.get("body"), label="ephemeris.spkw08.body"),
                center=_expect_int(step.get("center"), label="ephemeris.spkw08.center"),
                frame=_expect_string(step.get("frame"), label="ephemeris.spkw08.frame"),
                first=_expect_number(step.get("first"), label="ephemeris.spkw08.first"),
                last=_expect_number(step.get("last"), label="ephemeris.spkw08.last"),
                segid=_expect_string(step.get("segid"), label="ephemeris.spkw08.segid"),
                degree=_expect_int(step.get("degree"), label="ephemeris.spkw08.degree"),
                states=_expect_number_list(step.get("states"), label="ephemeris.spkw08.states"),
                epoch1=_expect_number(step.get("epoch1"), label="ephemeris.spkw08.epoch1"),
                step=_expect_number(step.get("step"), label="ephemeris.spkw08.step"),
            )


        case "file-io.rdtext":
            return StepFileIoRdtext(
                op=op,
                fileId=_expect_string(step.get("fileId"), label="file-io.rdtext.fileId"),
                text=_expect_string(step.get("text"), label="file-io.rdtext.text"),
                lineln=_expect_int(step.get("lineln"), label="file-io.rdtext.lineln"),
            )

        case "file-io.putcml":
            return StepFileIoPutcml(
                op=op,
                argv=_expect_string_list(step.get("argv"), label="file-io.putcml.argv"),
            )

        case "file-io.exists":
            return StepFileIoExists(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.exists.path"),
            )

        case "file-io.getfat":
            return StepFileIoGetfat(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.getfat.path"),
            )

        case "file-io.dafbbs":
            return StepFileIoDafbbs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafbbs.handleId"),
            )

        case "file-io.dafcs":
            return StepFileIoDafcs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafcs.handleId"),
            )

        case "file-io.daffpa":
            return StepFileIoDaffpa(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.daffpa.handleId"),
            )

        case "file-io.dafgh":
            return StepFileIoDafgh(
                op=op,
            )

        case "file-io.dafgn":
            return StepFileIoDafgn(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafgn.handleId"),
                namlen=_expect_int(step.get("namlen", 1001), label="file-io.dafgn.namlen"),
                captureError=_expect_bool(step.get("captureError", False), label="file-io.dafgn.captureError"),
            )

        case "file-io.dafgs":
            return StepFileIoDafgs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafgs.handleId"),
                summaryId=_expect_optional_string(step.get("summaryId"),label="file-io.dafgs.summaryId"),
            )

        case "file-io.dafhsf":
            return StepFileIoDafhsf(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafhsf.handleId"),
            )

        case "file-io.dafopw":
            return StepFileIoDafopw(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.dafopw.path"),
                handleId=_expect_string(step.get("handleId"), label="file-io.dafopw.handleId"),
            )

        case "file-io.dafac":
            return StepFileIoDafac(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafac.handleId"),
                lines=_expect_string_list(step.get("lines"), label="file-io.dafac.lines"),
            )

        case "file-io.dafdc":
            return StepFileIoDafdc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafdc.handleId"),
            )

        case "file-io.dafec":
            return StepFileIoDafec(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafec.handleId"),
                bufsiz=_expect_int(step.get("bufsiz"), label="file-io.dafec.bufsiz"),
                buffln=_expect_int(step.get("buffln", 1024), label="file-io.dafec.buffln"),
            )

        case "file-io.dafrs":
            return StepFileIoDafrs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafrs.handleId"),
                summary=_expect_daf_bytes(step.get("summary"), label="file-io.dafrs.summary"),
            )

        case "file-io.dafps":
            return StepFileIoDafps(
                op=op,
                nd=_expect_int(step.get("nd"), label="file-io.dafps.nd"),
                ni=_expect_int(step.get("ni"), label="file-io.dafps.ni"),
                dc=_expect_number_list(step.get("dc"), label="file-io.dafps.dc"),
                ic=_expect_int_list(step.get("ic"), label="file-io.dafps.ic"),
            )

        case "file-io.dafus":
            return StepFileIoDafus(
                op=op,
                summary=_expect_daf_bytes(step.get("summary"), label="file-io.dafus.summary"),
                nd=_expect_int(step.get("nd"), label="file-io.dafus.nd"),
                ni=_expect_int(step.get("ni"), label="file-io.dafus.ni"),
            )

        case "file-io.dafgsr":
            return StepFileIoDafgsr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafgsr.handleId"),
                recno=_expect_int(step.get("recno"), label="file-io.dafgsr.recno"),
                begin=_expect_int(step.get("begin"), label="file-io.dafgsr.begin"),
                end=_expect_int(step.get("end"), label="file-io.dafgsr.end"),
            )

        case "file-io.dafrfr":
            return StepFileIoDafrfr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafrfr.handleId"),
                ifnlen=_expect_int(step.get("ifnlen", 61), label="file-io.dafrfr.ifnlen"),
            )

        case "file-io.dafrda":
            return StepFileIoDafrda(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafrda.handleId"),
                begin=_expect_int(step.get("begin"), label="file-io.dafrda.begin"),
                end=_expect_int(step.get("end"), label="file-io.dafrda.end"),
            )

        case "file-io.dafgda":
            return StepFileIoDafgda(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafgda.handleId"),
                begin=_expect_int(step.get("begin"), label="file-io.dafgda.begin"),
                end=_expect_int(step.get("end"), label="file-io.dafgda.end"),
            )

        case "file-io.dafopr":
            return StepFileIoDafopr(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.dafopr.path"),
                handleId=_expect_string(step.get("handleId"), label="file-io.dafopr.handleId"),
            )

        case "file-io.dafcls":
            return StepFileIoDafcls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafcls.handleId"),
            )

        case "file-io.dafbfs":
            return StepFileIoDafbfs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dafbfs.handleId"),
            )

        case "file-io.daffna":
            return StepFileIoDaffna(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.daffna.handleId"),
            )

        case "file-io.dasopr":
            return StepFileIoDasopr(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.dasopr.path"),
                handleId=_expect_string(step.get("handleId"), label="file-io.dasopr.handleId"),
            )

        case "file-io.dasac":
            return StepFileIoDasac(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
                lines=_expect_string_list(step.get("lines"), label=op+".lines"),
            )

        case "file-io.dasdc":
            return StepFileIoDasdc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
            )

        case "file-io.dasec":
            return StepFileIoDasec(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
                bufsiz=_expect_int(step.get("bufsiz"), label=op+".bufsiz"),
                buffln=_expect_int(step.get("buffln", 1024), label=op+".buffln"),
            )

        case "file-io.dasadc":
            return StepFileIoDasadc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasadc.handleId"),
                n=_expect_int(step.get("n"), label="file-io.dasadc.n"),
                bpos=_expect_int(step.get("bpos"), label="file-io.dasadc.bpos"),
                epos=_expect_int(step.get("epos"), label="file-io.dasadc.epos"),
                datlen=_expect_int(step.get("datlen"), label="file-io.dasadc.datlen"),
                data=_expect_int_list(step.get("data"), label="file-io.dasadc.data"),
            )
        case "file-io.dasadd":
            return StepFileIoDasadd(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasadd.handleId"),
                n=_expect_int(step.get("n"), label="file-io.dasadd.n"),
                data=_expect_number_list(step.get("data"), label="file-io.dasadd.data"),
            )
        case "file-io.dasadi":
            return StepFileIoDasadi(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasadi.handleId"),
                n=_expect_int(step.get("n"), label="file-io.dasadi.n"),
                data=_expect_int_list(step.get("data"), label="file-io.dasadi.data"),
            )
        case "file-io.dasrdc":
            return StepFileIoDasrdc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasrdc.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasrdc.first"),
                last=_expect_int(step.get("last"), label="file-io.dasrdc.last"),
                bpos=_expect_int(step.get("bpos"), label="file-io.dasrdc.bpos"),
                epos=_expect_int(step.get("epos"), label="file-io.dasrdc.epos"),
                datlen=_expect_int(step.get("datlen"), label="file-io.dasrdc.datlen"),
                data=_expect_int_list(step.get("data"), label="file-io.dasrdc.data"),
            )
        case "file-io.dasrdd":
            return StepFileIoDasrdd(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasrdd.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasrdd.first"),
                last=_expect_int(step.get("last"), label="file-io.dasrdd.last"),
            )
        case "file-io.dasrdi":
            return StepFileIoDasrdi(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasrdi.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasrdi.first"),
                last=_expect_int(step.get("last"), label="file-io.dasrdi.last"),
            )
        case "file-io.dasudc":
            return StepFileIoDasudc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasudc.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasudc.first"),
                last=_expect_int(step.get("last"), label="file-io.dasudc.last"),
                bpos=_expect_int(step.get("bpos"), label="file-io.dasudc.bpos"),
                epos=_expect_int(step.get("epos"), label="file-io.dasudc.epos"),
                datlen=_expect_int(step.get("datlen"), label="file-io.dasudc.datlen"),
                data=_expect_int_list(step.get("data"), label="file-io.dasudc.data"),
            )
        case "file-io.dasudd":
            return StepFileIoDasudd(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasudd.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasudd.first"),
                last=_expect_int(step.get("last"), label="file-io.dasudd.last"),
                data=_expect_number_list(step.get("data"), label="file-io.dasudd.data"),
            )
        case "file-io.dasudi":
            return StepFileIoDasudi(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasudi.handleId"),
                first=_expect_int(step.get("first"), label="file-io.dasudi.first"),
                last=_expect_int(step.get("last"), label="file-io.dasudi.last"),
                data=_expect_int_list(step.get("data"), label="file-io.dasudi.data"),
            )
        case "file-io.dasonw":
            return StepFileIoDasonw(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasonw.handleId"),
                path=_decode_path_ref(step.get("path"), label="file-io.dasonw.path"),
                ftype=_expect_string(step.get("ftype"), label="file-io.dasonw.ftype"),
                ifname=_expect_string(step.get("ifname"), label="file-io.dasonw.ifname"),
                ncomr=_expect_int(step.get("ncomr"), label="file-io.dasonw.ncomr"),
            )

        case "file-io.dasops":
            return StepFileIoDasops(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasops.handleId"),
            )

        case "file-io.dasopw":
            return StepFileIoDasopw(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasopw.handleId"),
                path=_decode_path_ref(step.get("path"), label="file-io.dasopw.path"),
            )

        case "file-io.dashfn":
            return StepFileIoDashfn(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dashfn.handleId"),
                namlen=_expect_int(step.get("namlen", 256), label="file-io.dashfn.namlen"),
            )

        case "file-io.dashfs":
            return StepFileIoDashfs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dashfs.handleId"),
            )

        case "file-io.daslla":
            return StepFileIoDaslla(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.daslla.handleId"),
            )

        case "file-io.dasllc":
            return StepFileIoDasllc(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasllc.handleId"),
            )

        case "file-io.dasrfr":
            return StepFileIoDasrfr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dasrfr.handleId"),
                idwlen=_expect_int(step.get("idwlen", 9), label="file-io.dasrfr.idwlen"),
                ifnlen=_expect_int(step.get("ifnlen", 61), label="file-io.dasrfr.ifnlen"),
            )

        case "file-io.daswbr":
            return StepFileIoDaswbr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.daswbr.handleId"),
            )

        case "file-io.dascls":
            return StepFileIoDascls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dascls.handleId"),
            )

        case "file-io.dlaopn":
            return StepFileIoDlaopn(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.dlaopn.path"),
                ftype=_expect_string(step.get("ftype"), label="file-io.dlaopn.ftype"),
                ifname=_expect_string(step.get("ifname"), label="file-io.dlaopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="file-io.dlaopn.ncomch"),
                handleId=_expect_string(step.get("handleId"), label="file-io.dlaopn.handleId"),
            )

        case "file-io.dlabbs":
            return StepFileIoDlabbs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
                descrId=_expect_string(step.get("descrId"), label=op+".descrId"),
            )

        case "file-io.dlabns":
            return StepFileIoDlabns(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
            )

        case "file-io.dlaens":
            return StepFileIoDlaens(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
            )

        case "file-io.dlafps":
            return StepFileIoDlafps(
                op=op,
                handleId=_expect_string(step.get("handleId"), label=op+".handleId"),
                descrId=_expect_string(step.get("descrId"), label=op+".descrId"),
            )

        case "file-io.dlabfs":
            return StepFileIoDlabfs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dlabfs.handleId"),
                descrId=_expect_string(step.get("descrId"), label="file-io.dlabfs.descrId"),
            )

        case "file-io.dlafns":
            return StepFileIoDlafns(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dlafns.handleId"),
                descrId=_expect_string(step.get("descrId"), label="file-io.dlafns.descrId"),
            )

        case "file-io.dlacls":
            return StepFileIoDlacls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dlacls.handleId"),
            )

        case "file-io.dskopn":
            return StepFileIoDskopn(
                op=op,
                path=_decode_path_ref(step.get("path"), label="file-io.dskopn.path"),
                ifname=_expect_string(step.get("ifname"), label="file-io.dskopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="file-io.dskopn.ncomch"),
                handleId=_expect_string(step.get("handleId"), label="file-io.dskopn.handleId"),
            )

        case "file-io.dskmi2":
            return StepFileIoDskmi2(
                op=op,
                nv=_expect_int(step.get("nv"), label="file-io.dskmi2.nv"),
                vrtces=_expect_number_list(step.get("vrtces"), label="file-io.dskmi2.vrtces"),
                np=_expect_int(step.get("np"), label="file-io.dskmi2.np"),
                plates=_expect_int_list(step.get("plates"), label="file-io.dskmi2.plates"),
                finscl=_expect_number(step.get("finscl"), label="file-io.dskmi2.finscl"),
                corscl=_expect_int(step.get("corscl"), label="file-io.dskmi2.corscl"),
                worksz=_expect_int(step.get("worksz"), label="file-io.dskmi2.worksz"),
                voxpsz=_expect_int(step.get("voxpsz"), label="file-io.dskmi2.voxpsz"),
                voxlsz=_expect_int(step.get("voxlsz"), label="file-io.dskmi2.voxlsz"),
                makvtl=_expect_bool(step.get("makvtl"), label="file-io.dskmi2.makvtl"),
                spxisz=_expect_int(step.get("spxisz"), label="file-io.dskmi2.spxisz"),
                spaixId=_expect_optional_string(step.get("spaixId"), label="file-io.dskmi2.spaixId"),
            )

        case "file-io.dskw02":
            return StepFileIoDskw02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="file-io.dskw02.handleId"),
                center=_expect_int(step.get("center"), label="file-io.dskw02.center"),
                surfid=_expect_int(step.get("surfid"), label="file-io.dskw02.surfid"),
                dclass=_expect_int(step.get("dclass"), label="file-io.dskw02.dclass"),
                frame=_expect_string(step.get("frame"), label="file-io.dskw02.frame"),
                corsys=_expect_int(step.get("corsys"), label="file-io.dskw02.corsys"),
                corpar=_expect_number_list(step.get("corpar"), label="file-io.dskw02.corpar"),
                mncor1=_expect_number(step.get("mncor1"), label="file-io.dskw02.mncor1"),
                mxcor1=_expect_number(step.get("mxcor1"), label="file-io.dskw02.mxcor1"),
                mncor2=_expect_number(step.get("mncor2"), label="file-io.dskw02.mncor2"),
                mxcor2=_expect_number(step.get("mxcor2"), label="file-io.dskw02.mxcor2"),
                mncor3=_expect_number(step.get("mncor3"), label="file-io.dskw02.mncor3"),
                mxcor3=_expect_number(step.get("mxcor3"), label="file-io.dskw02.mxcor3"),
                first=_expect_number(step.get("first"), label="file-io.dskw02.first"),
                last=_expect_number(step.get("last"), label="file-io.dskw02.last"),
                nv=_expect_int(step.get("nv"), label="file-io.dskw02.nv"),
                vrtces=_expect_number_list(step.get("vrtces"), label="file-io.dskw02.vrtces"),
                np=_expect_int(step.get("np"), label="file-io.dskw02.np"),
                plates=_expect_int_list(step.get("plates"), label="file-io.dskw02.plates"),
                spaixId=_expect_string(step.get("spaixId"), label="file-io.dskw02.spaixId"),
            )
        case "error.errdev":
            operation = _expect_string(step.get("operation"), label="errdev.operation")
            if operation == "GET":
                capacity = step.get("capacity")
                return StepErrorErrdev(op=op, operation=operation, capacity=None if capacity is None else _expect_int(capacity,label="errdev.capacity"))
            if operation == "SET":
                return StepErrorErrdev(op=op, operation=operation, value=_expect_string(step.get("value"), label="errdev.value"))
            raise ValueError("Expected GET or SET")

        case "error.errprt":
            operation = _expect_string(step.get("operation"), label="errprt.operation")
            if operation == "GET":
                capacity = step.get("capacity")
                return StepErrorErrprt(op=op, operation=operation, capacity=None if capacity is None else _expect_int(capacity,label="errprt.capacity"))
            if operation == "SET":
                return StepErrorErrprt(op=op, operation=operation, value=_expect_string(step.get("value"), label="errprt.value"))
            raise ValueError("Expected GET or SET")

        case "error.trcoff":
            return StepErrorTrcoff(op=op)

        case "error.errch":
            return StepErrorErrch(op=op,
                marker=_expect_string(step.get("marker"), label="error.errch.marker"),
                value=_expect_string(step.get("value"), label="error.errch.value"))

        case "error.errdp":
            return StepErrorErrdp(op=op,
                marker=_expect_string(step.get("marker"), label="error.errdp.marker"),
                value=_expect_number(step.get("value"), label="error.errdp.value"))

        case "error.errint":
            return StepErrorErrint(op=op,
                marker=_expect_string(step.get("marker"), label="error.errint.marker"),
                value=_expect_int(step.get("value"), label="error.errint.value"))

        case "error.qcktrc":
            return StepErrorQcktrc(op=op,
                tracelen=None if step.get("tracelen") is None else _expect_int(step.get("tracelen"), label="error.qcktrc.tracelen"))

        case "error.return":
            return StepErrorReturn(op=op)

        case "error.trcdep":
            return StepErrorTrcdep(op=op)

        case "error.trcnam":
            return StepErrorTrcnam(op=op,
                index=_expect_int(step.get("index"), label="error.trcnam.index"),
                namlen=None if step.get("namlen") is None else _expect_int(step.get("namlen"), label="error.trcnam.namlen"))

        case "error.failed":
            return StepErrorFailed(op=op)

        case "error.reset":
            return StepErrorReset(op=op)

        case "error.getmsg":
            return StepErrorGetmsg(
                op=op,
                which=_expect_string(step.get("which"), label="error.getmsg.which"),
            )

        case "error.setmsg":
            return StepErrorSetmsg(
                op=op,
                message=_expect_string(step.get("message"), label="error.setmsg.message"),
            )

        case "error.sigerr":
            return StepErrorSigerr(
                op=op,
                short=_expect_string(step.get("short"), label="error.sigerr.short"),
                capture=_expect_bool(step.get("capture", False), label="error.sigerr.capture"),
            )

        case "error.chkin":
            return StepErrorChkin(
                op=op,
                name=_expect_string(step.get("name"), label="error.chkin.name"),
            )

        case "error.chkout":
            return StepErrorChkout(
                op=op,
                name=_expect_string(step.get("name"), label="error.chkout.name"),
            )

        case "frames.namfrm":
            return StepFramesNamfrm(op=op, name=_expect_string(step.get("name"), label="frames.namfrm.name"))

        case "frames.frmnam":
            return StepFramesFrmnam(op=op, code=_expect_int(step.get("code"), label="frames.frmnam.code"))

        case "frames.cidfrm":
            return StepFramesCidfrm(op=op, center=_expect_int(step.get("center"), label="frames.cidfrm.center"))

        case "frames.cnmfrm":
            return StepFramesCnmfrm(
                op=op,
                centerName=_expect_string(step.get("centerName"), label="frames.cnmfrm.centerName"),
            )

        case "frames.frinfo":
            return StepFramesFrinfo(op=op, frameId=_expect_int(step.get("frameId"), label="frames.frinfo.frameId"))

        case "frames.ccifrm":
            return StepFramesCcifrm(
                op=op,
                frameClass=_expect_int(step.get("frameClass"), label="frames.ccifrm.frameClass"),
                classId=_expect_int(step.get("classId"), label="frames.ccifrm.classId"),
            )

        case "frames.ckgp":
            return StepFramesCkgp(
                op=op,
                inst=_expect_int(step.get("inst"), label="frames.ckgp.inst"),
                sclkdp=_expect_number(step.get("sclkdp"), label="frames.ckgp.sclkdp"),
                tol=_expect_number(step.get("tol"), label="frames.ckgp.tol"),
                ref=_expect_string(step.get("ref"), label="frames.ckgp.ref"),
            )

        case "frames.ckgpav":
            return StepFramesCkgpav(
                op=op,
                inst=_expect_int(step.get("inst"), label="frames.ckgpav.inst"),
                sclkdp=_expect_number(step.get("sclkdp"), label="frames.ckgpav.sclkdp"),
                tol=_expect_number(step.get("tol"), label="frames.ckgpav.tol"),
                ref=_expect_string(step.get("ref"), label="frames.ckgpav.ref"),
            )

        case "frames.ckfrot":
            return StepFramesCkfrot(
                op=op,
                inst=_expect_int(step.get("inst"), label="frames.ckfrot.inst"),
                et=_expect_number(step.get("et"), label="frames.ckfrot.et"),
            )

        case "frames.ckfxfm":
            return StepFramesCkfxfm(
                op=op,
                inst=_expect_int(step.get("inst"), label="frames.ckfxfm.inst"),
                et=_expect_number(step.get("et"), label="frames.ckfxfm.et"),
            )

        case "frames.ckgr02":
            return StepFramesCkgr02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.ckgr02.handleId"),
                summaryId=_expect_string(step.get("summaryId"), label="frames.ckgr02.summaryId"),
                recno=_expect_int(step.get("recno"), label="frames.ckgr02.recno"),
            )

        case "frames.ckgr03":
            return StepFramesCkgr03(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.ckgr03.handleId"),
                summaryId=_expect_string(step.get("summaryId"), label="frames.ckgr03.summaryId"),
                recno=_expect_int(step.get("recno"), label="frames.ckgr03.recno"),
            )

        case "frames.ckmeta":
            return StepFramesCkmeta(
                op=op,
                ckid=_expect_int(step.get("ckid"), label="frames.ckmeta.ckid"),
                meta=_expect_string(step.get("meta"), label="frames.ckmeta.meta"),
            )

        case "frames.cknr02":
            return StepFramesCknr02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.cknr02.handleId"),
                summaryId=_expect_string(step.get("summaryId"), label="frames.cknr02.summaryId"),
            )

        case "frames.cknr03":
            return StepFramesCknr03(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.cknr03.handleId"),
                summaryId=_expect_string(step.get("summaryId"), label="frames.cknr03.summaryId"),
            )

        case "frames.pckcls":
            return StepFramesPckcls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.pckcls.handleId"),
            )

        case "frames.pckcov":
            return StepFramesPckcov(
                op=op,
                path=_decode_path_ref(step.get("path"), label="frames.pckcov.path"),
                classId=_expect_int(step.get("classId"), label="frames.pckcov.classId"),
                coverId=_expect_string(step.get("coverId"), label="frames.pckcov.coverId"),
                maxIntervals=_expect_int(step.get("maxIntervals"), label="frames.pckcov.maxIntervals"),
                reset=_expect_bool(step.get("reset"), label="frames.pckcov.reset"),
            )

        case "frames.pckfrm":
            return StepFramesPckfrm(
                op=op,
                path=_decode_path_ref(step.get("path"), label="frames.pckfrm.path"),
                idsId=_expect_string(step.get("idsId"), label="frames.pckfrm.idsId"),
                maxCard=_expect_int(step.get("maxCard"), label="frames.pckfrm.maxCard"),
                reset=_expect_bool(step.get("reset"), label="frames.pckfrm.reset"),
            )

        case "frames.pcklof":
            return StepFramesPcklof(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.pcklof.handleId"),
                path=_decode_path_ref(step.get("path"), label="frames.pcklof.path"),
            )

        case "frames.pckopn":
            return StepFramesPckopn(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.pckopn.handleId"),
                path=_decode_path_ref(step.get("path"), label="frames.pckopn.path"),
                ifname=_expect_string(step.get("ifname"), label="frames.pckopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="frames.pckopn.ncomch"),
            )

        case "frames.pckuof":
            return StepFramesPckuof(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.pckuof.handleId"),
            )

        case "frames.pckw02":
            return StepFramesPckw02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.pckw02.handleId"),
                classId=_expect_int(step.get("classId"), label="frames.pckw02.classId"),
                frame=_expect_string(step.get("frame"), label="frames.pckw02.frame"),
                first=_expect_number(step.get("first"), label="frames.pckw02.first"),
                last=_expect_number(step.get("last"), label="frames.pckw02.last"),
                segid=_expect_string(step.get("segid"), label="frames.pckw02.segid"),
                intlen=_expect_number(step.get("intlen"), label="frames.pckw02.intlen"),
                n=_expect_int(step.get("n"), label="frames.pckw02.n"),
                degree=_expect_int(step.get("degree"), label="frames.pckw02.degree"),
                coefficients=_expect_number_list(step.get("coefficients"), label="frames.pckw02.coefficients"),
                btime=_expect_number(step.get("btime"), label="frames.pckw02.btime"),
            )

        case "frames.ckopn":
            return StepFramesCkopn(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckopn.handleId"),
                path=_decode_path_ref(step.get("path"),label="frames.ckopn.path"),
                ifname=_expect_string(step.get("ifname"),label="frames.ckopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"),label="frames.ckopn.ncomch"),
            )

        case "frames.ckcls":
            return StepFramesCkcls(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckcls.handleId"),
            )

        case "frames.ckw01":
            return StepFramesCkw01(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckw01.handleId"),
                beg=_expect_number(step.get("beg"),label="frames.ckw01.beg"),
                end=_expect_number(step.get("end"),label="frames.ckw01.end"),
                inst=_expect_int(step.get("inst"),label="frames.ckw01.inst"),
                ref=_expect_string(step.get("ref"),label="frames.ckw01.ref"),
                av=_expect_bool(step.get("av"),label="frames.ckw01.av"),
                segid=_expect_string(step.get("segid"),label="frames.ckw01.segid"),
                ticks=_expect_number_list(step.get("ticks"),label="frames.ckw01.ticks"),
                quats=_expect_number_list(step.get("quats"),label="frames.ckw01.quats"),
                avvs=_expect_number_list(step.get("avvs"),label="frames.ckw01.avvs"),
            )

        case "frames.ckw02":
            return StepFramesCkw02(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckw02.handleId"),
                beg=_expect_number(step.get("beg"),label="frames.ckw02.beg"),
                end=_expect_number(step.get("end"),label="frames.ckw02.end"),
                inst=_expect_int(step.get("inst"),label="frames.ckw02.inst"),
                ref=_expect_string(step.get("ref"),label="frames.ckw02.ref"),
                segid=_expect_string(step.get("segid"),label="frames.ckw02.segid"),
                starts=_expect_number_list(step.get("starts"),label="frames.ckw02.starts"),
                stops=_expect_number_list(step.get("stops"),label="frames.ckw02.stops"),
                quats=_expect_number_list(step.get("quats"),label="frames.ckw02.quats"),
                avvs=_expect_number_list(step.get("avvs"),label="frames.ckw02.avvs"),
                rates=_expect_number_list(step.get("rates"),label="frames.ckw02.rates"),
            )

        case "frames.ckw03":
            return StepFramesCkw03(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckw03.handleId"),
                beg=_expect_number(step.get("beg"),label="frames.ckw03.beg"),
                end=_expect_number(step.get("end"),label="frames.ckw03.end"),
                inst=_expect_int(step.get("inst"),label="frames.ckw03.inst"),
                ref=_expect_string(step.get("ref"),label="frames.ckw03.ref"),
                av=_expect_bool(step.get("av"),label="frames.ckw03.av"),
                segid=_expect_string(step.get("segid"),label="frames.ckw03.segid"),
                ticks=_expect_number_list(step.get("ticks"),label="frames.ckw03.ticks"),
                quats=_expect_number_list(step.get("quats"),label="frames.ckw03.quats"),
                avvs=_expect_number_list(step.get("avvs"),label="frames.ckw03.avvs"),
                intervalStarts=_expect_number_list(step.get("intervalStarts"),label="frames.ckw03.intervalStarts"),
            )

        case "frames.ckw05":
            return StepFramesCkw05(
                op=op,
                handleId=_expect_string(step.get("handleId"),label="frames.ckw05.handleId"),
                subtype=_expect_int(step.get("subtype"),label="frames.ckw05.subtype"),
                degree=_expect_int(step.get("degree"),label="frames.ckw05.degree"),
                beg=_expect_number(step.get("beg"),label="frames.ckw05.beg"),
                end=_expect_number(step.get("end"),label="frames.ckw05.end"),
                inst=_expect_int(step.get("inst"),label="frames.ckw05.inst"),
                ref=_expect_string(step.get("ref"),label="frames.ckw05.ref"),
                av=_expect_bool(step.get("av"),label="frames.ckw05.av"),
                segid=_expect_string(step.get("segid"),label="frames.ckw05.segid"),
                ticks=_expect_number_list(step.get("ticks"),label="frames.ckw05.ticks"),
                packets=_expect_number_list(step.get("packets"),label="frames.ckw05.packets"),
                rate=_expect_number(step.get("rate"),label="frames.ckw05.rate"),
                intervalStarts=_expect_number_list(step.get("intervalStarts"),label="frames.ckw05.intervalStarts"),
            )

        case "frames.cklpf":
            return StepFramesCklpf(
                op=op,
                ck=_decode_path_ref(step.get("ck"), label="frames.cklpf.ck"),
                handleId=_expect_string(step.get("handleId"), label="frames.cklpf.handleId"),
            )

        case "frames.ckupf":
            return StepFramesCkupf(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="frames.ckupf.handleId"),
            )

        case "frames.ckobj":
            max_card_raw = step.get("maxCard")
            max_card = None
            if max_card_raw is not None:
                max_card = _expect_int(max_card_raw, label="frames.ckobj.maxCard")
            return StepFramesCkobj(
                op=op,
                ck=_decode_path_ref(step.get("ck"), label="frames.ckobj.ck"),
                idsId=_expect_string(step.get("idsId"), label="frames.ckobj.idsId"),
                maxCard=max_card,
                reset=_expect_bool(step.get("reset", True), label="frames.ckobj.reset"),
            )

        case "frames.ckcov":
            level = _expect_string(step.get("level"), label="frames.ckcov.level")
            if level not in {"SEGMENT", "INTERVAL"}:
                raise ValueError("frames.ckcov.level must be SEGMENT|INTERVAL")

            timsys = _expect_string(step.get("timsys"), label="frames.ckcov.timsys")
            if timsys not in {"SCLK", "TDB"}:
                raise ValueError("frames.ckcov.timsys must be SCLK|TDB")

            max_intervals_raw = step.get("maxIntervals")
            max_intervals = None
            if max_intervals_raw is not None:
                max_intervals = _expect_int(max_intervals_raw, label="frames.ckcov.maxIntervals")

            return StepFramesCkcov(
                op=op,
                ck=_decode_path_ref(step.get("ck"), label="frames.ckcov.ck"),
                idcode=_expect_int(step.get("idcode"), label="frames.ckcov.idcode"),
                needav=_expect_bool(step.get("needav"), label="frames.ckcov.needav"),
                level=level,
                tol=_expect_number(step.get("tol"), label="frames.ckcov.tol"),
                timsys=timsys,
                coverId=_expect_string(step.get("coverId"), label="frames.ckcov.coverId"),
                maxIntervals=max_intervals,
                reset=_expect_bool(step.get("reset", True), label="frames.ckcov.reset"),
            )

        case "frames.bltfrm":
            return StepFramesBltfrm(
                op=op,
                frameClass=_expect_int(step.get("frameClass"), label="frames.bltfrm.frameClass"),
                idsId=_expect_string(step.get("idsId"), label="frames.bltfrm.idsId"),
                maxCard=_expect_int(step.get("maxCard"), label="frames.bltfrm.maxCard"),
            )
        case "frames.pxfrm2":
            return StepFramesPxfrm2(
                op=op,
                from_=_expect_string(step.get("from"), label="frames.pxfrm2.from"),
                to=_expect_string(step.get("to"), label="frames.pxfrm2.to"),
                etfrom=_expect_number(step.get("etfrom"), label="frames.pxfrm2.etfrom"),
                etto=_expect_number(step.get("etto"), label="frames.pxfrm2.etto"),
            )
        case "frames.tipbod":
            return StepFramesTipbod(
                op=op,
                ref=_expect_string(step.get("ref"), label="frames.tipbod.ref"),
                body=_expect_int(step.get("body"), label="frames.tipbod.body"),
                et=_expect_number(step.get("et"), label="frames.tipbod.et"),
            )
        case "frames.tisbod":
            return StepFramesTisbod(
                op=op,
                ref=_expect_string(step.get("ref"), label="frames.tisbod.ref"),
                body=_expect_int(step.get("body"), label="frames.tisbod.body"),
                et=_expect_number(step.get("et"), label="frames.tisbod.et"),
            )
        case "frames.tkfram":
            return StepFramesTkfram(
                op=op,
                typeId=_expect_int(step.get("typeId"), label="frames.tkfram.typeId"),
            )
        case "frames.xfmsta":
            state = _expect_number_list(step.get("state"), label="frames.xfmsta.state")
            if len(state) != 6:
                raise ValueError("frames.xfmsta.state must have six components")
            return StepFramesXfmsta(
                op=op,
                state=state,
                from_=_expect_string(step.get("from"), label="frames.xfmsta.from"),
                to=_expect_string(step.get("to"), label="frames.xfmsta.to"),
                body=_expect_string(step.get("body"), label="frames.xfmsta.body"),
            )
        case "frames.pxform":
            return StepFramesPxform(
                op=op,
                from_=_expect_string(step.get("from"), label="frames.pxform.from"),
                to=_expect_string(step.get("to"), label="frames.pxform.to"),
                et=_expect_number(step.get("et"), label="frames.pxform.et"),
            )

        case "frames.frame":
            return StepFramesFrame(
                op=op,
                x=_expect_vec3(step.get("x"), label="frames.frame.x"),
            )

        case "frames.twovec":
            return StepFramesTwovec(
                op=op,
                axdef=_expect_vec3(step.get("axdef"), label="frames.twovec.axdef"),
                indexa=_expect_int(step.get("indexa"), label="frames.twovec.indexa"),
                plndef=_expect_vec3(step.get("plndef"), label="frames.twovec.plndef"),
                indexp=_expect_int(step.get("indexp"), label="frames.twovec.indexp"),
            )

        case "frames.twovxf":
            return StepFramesTwovxf(
                op=op,
                axdef=_frame_words(step.get("axdef"), 6, label="frames.twovxf.axdef"),
                indexa=_expect_int(step.get("indexa"), label="frames.twovxf.indexa"),
                plndef=_frame_words(step.get("plndef"), 6, label="frames.twovxf.plndef"),
                indexp=_expect_int(step.get("indexp"), label="frames.twovxf.indexp"),
            )

        case "frames.eul2xf":
            return StepFramesEul2xf(
                op=op,
                eulang=_frame_words(step.get("eulang"), 6, label="frames.eul2xf.eulang"),
                axisa=_expect_int(step.get("axisa"), label="frames.eul2xf.axisa"),
                axisb=_expect_int(step.get("axisb"), label="frames.eul2xf.axisb"),
                axisc=_expect_int(step.get("axisc"), label="frames.eul2xf.axisc"),
            )

        case "frames.xf2eul":
            return StepFramesXf2eul(
                op=op,
                xform=_frame_matrix(step.get("xform"), label="frames.xf2eul.xform"),
                axisa=_expect_int(step.get("axisa"), label="frames.xf2eul.axisa"),
                axisb=_expect_int(step.get("axisb"), label="frames.xf2eul.axisb"),
                axisc=_expect_int(step.get("axisc"), label="frames.xf2eul.axisc"),
            )

        case "frames.xf2rav":
            return StepFramesXf2rav(
                op=op,
                xform=_frame_matrix(step.get("xform"), label="frames.xf2rav.xform"),
            )

        case "frames.rav2xf":
            return StepFramesRav2xf(
                op=op,
                rot=_expect_3x3_matrix(step.get("rot"), label="frames.rav2xf.rot"),
                av=_expect_vec3(step.get("av"), label="frames.rav2xf.av"),
            )

        case "frames.invstm":
            return StepFramesInvstm(
                op=op,
                mat=_frame_matrix(step.get("mat"), label="frames.invstm.mat"),
            )

        case "frames.xpose6":
            return StepFramesXpose6(
                op=op,
                m1=_frame_matrix(step.get("m1"), label="frames.xpose6.m1"),
            )

        case "frames.sxform":
            return StepFramesSxform(
                op=op,
                from_=_expect_string(step.get("from"), label="frames.sxform.from"),
                to=_expect_string(step.get("to"), label="frames.sxform.to"),
                et=_expect_number(step.get("et"), label="frames.sxform.et"),
            )

        case "ek.ekfind":
            return StepEkEkfind(op=op, query=_expect_string(step.get("query"), label="ek.ekfind.query"))

        case "ek.ekops":
            return StepEkEkops(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekops.handleId"),
            )
        case "ek.ekbseg":
            return StepEkEkbseg(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekbseg.handleId"),
                tabnam=_expect_string(step.get("tabnam"), label="ek.ekbseg.tabnam"),
                cnames=_expect_string_list(step.get("cnames"), label="ek.ekbseg.cnames"),
                decls=_expect_string_list(step.get("decls"), label="ek.ekbseg.decls"),
            )
        case "ek.ekappr":
            return StepEkEkappr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekappr.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekappr.segno"),
            )
        case "ek.ekinsr":
            return StepEkEkinsr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekinsr.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekinsr.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekinsr.recno"),
            )
        case "ek.ekdelr":
            return StepEkEkdelr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekdelr.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekdelr.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekdelr.recno"),
            )
        case "ek.ekacec":
            return StepEkEkacec(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekacec.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekacec.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekacec.recno"),
                column=_expect_string(step.get("column"), label="ek.ekacec.column"),
                values=_expect_string_list(step.get("values"), label="ek.ekacec.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekacec.isNull"),
            )
        case "ek.ekaced":
            return StepEkEkaced(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekaced.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekaced.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekaced.recno"),
                column=_expect_string(step.get("column"), label="ek.ekaced.column"),
                values=_expect_number_list(step.get("values"), label="ek.ekaced.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekaced.isNull"),
            )
        case "ek.ekacei":
            return StepEkEkacei(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekacei.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekacei.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekacei.recno"),
                column=_expect_string(step.get("column"), label="ek.ekacei.column"),
                values=_expect_int_list(step.get("values"), label="ek.ekacei.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekacei.isNull"),
            )
        case "ek.ekrcec":
            return StepEkEkrcec(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekrcec.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekrcec.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekrcec.recno"),
                column=_expect_string(step.get("column"), label="ek.ekrcec.column"),
                lenout=_expect_int(step.get("lenout"), label="ek.ekrcec.lenout"),
            )
        case "ek.ekrced":
            return StepEkEkrced(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekrced.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekrced.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekrced.recno"),
                column=_expect_string(step.get("column"), label="ek.ekrced.column"),
            )
        case "ek.ekrcei":
            return StepEkEkrcei(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekrcei.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekrcei.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekrcei.recno"),
                column=_expect_string(step.get("column"), label="ek.ekrcei.column"),
            )
        case "ek.ekucec":
            return StepEkEkucec(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekucec.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekucec.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekucec.recno"),
                column=_expect_string(step.get("column"), label="ek.ekucec.column"),
                values=_expect_string_list(step.get("values"), label="ek.ekucec.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekucec.isNull"),
            )
        case "ek.ekuced":
            return StepEkEkuced(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekuced.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekuced.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekuced.recno"),
                column=_expect_string(step.get("column"), label="ek.ekuced.column"),
                values=_expect_number_list(step.get("values"), label="ek.ekuced.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekuced.isNull"),
            )
        case "ek.ekucei":
            return StepEkEkucei(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekucei.handleId"),
                segno=_expect_int(step.get("segno"), label="ek.ekucei.segno"),
                recno=_expect_int(step.get("recno"), label="ek.ekucei.recno"),
                column=_expect_string(step.get("column"), label="ek.ekucei.column"),
                values=_expect_int_list(step.get("values"), label="ek.ekucei.values"),
                isNull=_expect_bool(step.get("isNull"), label="ek.ekucei.isNull"),
            )
        case "ek.ekccnt":
            return StepEkEkccnt(op=op,
                table=_expect_string(step.get("table"),label="ek.ekccnt.table"),
            )
        case "ek.ekcii":
            return StepEkEkcii(op=op,
                table=_expect_string(step.get("table"),label="ek.ekcii.table"),
                cindex=_expect_int(step.get("cindex"),label="ek.ekcii.cindex"),
                collen=_expect_int(step.get("collen"),label="ek.ekcii.collen"),
            )
        case "ek.eklef":
            return StepEkEklef(op=op,
                path=_decode_path_ref(step.get("path"),label="ek.eklef.path"),
                handleId=_expect_string(step.get("handleId"),label="ek.eklef.handleId"),
            )
        case "ek.eknelt":
            return StepEkEknelt(op=op,
                selidx=_expect_int(step.get("selidx"),label="ek.eknelt.selidx"),
                row=_expect_int(step.get("row"),label="ek.eknelt.row"),
            )
        case "ek.ekpsel":
            return StepEkEkpsel(op=op,
                query=_expect_string(step.get("query"),label="ek.ekpsel.query"),
            )
        case "ek.ekssum":
            return StepEkEkssum(op=op,
                handleId=_expect_string(step.get("handleId"),label="ek.ekssum.handleId"),
                segno=_expect_int(step.get("segno"),label="ek.ekssum.segno"),
            )
        case "ek.ekuef":
            return StepEkEkuef(op=op,
                handleId=_expect_string(step.get("handleId"),label="ek.ekuef.handleId"),
            )
        case "ek.ekopn":
            return StepEkEkopn(
                op=op,
                path=_decode_path_ref(step.get("path"), label="ek.ekopn.path"),
                ifname=_expect_string(step.get("ifname"), label="ek.ekopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="ek.ekopn.ncomch"),
                handleId=_expect_string(step.get("handleId"), label="ek.ekopn.handleId"),
            )

        case "ek.ekopr":
            return StepEkEkopr(
                op=op,
                path=_decode_path_ref(step.get("path"), label="ek.ekopr.path"),
                handleId=_expect_string(step.get("handleId"), label="ek.ekopr.handleId"),
            )

        case "ek.ekopw":
            return StepEkEkopw(
                op=op,
                path=_decode_path_ref(step.get("path"), label="ek.ekopw.path"),
                handleId=_expect_string(step.get("handleId"), label="ek.ekopw.handleId"),
            )

        case "ek.ekcls":
            return StepEkEkcls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekcls.handleId"),
            )

        case "ek.ekntab":
            return StepEkEkntab(op=op)

        case "ek.ektnam":
            return StepEkEktnam(op=op, n=_expect_int(step.get("n"), label="ek.ektnam.n"))

        case "ek.eknseg":
            return StepEkEknseg(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.eknseg.handleId"),
            )

        case "ek.ekgc":
            return StepEkEkgc(
                op=op,
                selidx=_expect_int(step.get("selidx"), label="ek.ekgc.selidx"),
                row=_expect_int(step.get("row"), label="ek.ekgc.row"),
                elment=_expect_int(step.get("elment"), label="ek.ekgc.elment"),
            )

        case "ek.ekgd":
            return StepEkEkgd(
                op=op,
                selidx=_expect_int(step.get("selidx"), label="ek.ekgd.selidx"),
                row=_expect_int(step.get("row"), label="ek.ekgd.row"),
                elment=_expect_int(step.get("elment"), label="ek.ekgd.elment"),
            )

        case "ek.ekgi":
            return StepEkEkgi(
                op=op,
                selidx=_expect_int(step.get("selidx"), label="ek.ekgi.selidx"),
                row=_expect_int(step.get("row"), label="ek.ekgi.row"),
                elment=_expect_int(step.get("elment"), label="ek.ekgi.elment"),
            )

        case "ek.ekifld":
            return StepEkEkifld(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ek.ekifld.handleId"),
                tabnam=_expect_string(step.get("tabnam"), label="ek.ekifld.tabnam"),
                nrows=_expect_int(step.get("nrows"), label="ek.ekifld.nrows"),
                cnames=_expect_string_list(step.get("cnames"), label="ek.ekifld.cnames"),
                decls=_expect_string_list(step.get("decls"), label="ek.ekifld.decls"),
                segmentId=_expect_string(step.get("segmentId"), label="ek.ekifld.segmentId"),
            )

        case "ek.ekacli":
            return StepEkEkacli(
                op=op,
                segmentId=_expect_string(step.get("segmentId"), label="ek.ekacli.segmentId"),
                column=_expect_string(step.get("column"), label="ek.ekacli.column"),
                ivals=_expect_int_list(step.get("ivals"), label="ek.ekacli.ivals"),
                entszs=_expect_int_list(step.get("entszs"), label="ek.ekacli.entszs"),
                nlflgs=_expect_bool_list(step.get("nlflgs"), label="ek.ekacli.nlflgs"),
            )

        case "ek.ekacld":
            return StepEkEkacld(
                op=op,
                segmentId=_expect_string(step.get("segmentId"), label="ek.ekacld.segmentId"),
                column=_expect_string(step.get("column"), label="ek.ekacld.column"),
                dvals=_expect_number_list(step.get("dvals"), label="ek.ekacld.dvals"),
                entszs=_expect_int_list(step.get("entszs"), label="ek.ekacld.entszs"),
                nlflgs=_expect_bool_list(step.get("nlflgs"), label="ek.ekacld.nlflgs"),
            )

        case "ek.ekaclc":
            return StepEkEkaclc(
                op=op,
                segmentId=_expect_string(step.get("segmentId"), label="ek.ekaclc.segmentId"),
                column=_expect_string(step.get("column"), label="ek.ekaclc.column"),
                cvals=_expect_string_list(step.get("cvals"), label="ek.ekaclc.cvals"),
                entszs=_expect_int_list(step.get("entszs"), label="ek.ekaclc.entszs"),
                nlflgs=_expect_bool_list(step.get("nlflgs"), label="ek.ekaclc.nlflgs"),
            )

        case "ek.ekffld":
            return StepEkEkffld(
                op=op,
                segmentId=_expect_string(step.get("segmentId"), label="ek.ekffld.segmentId"),
            )

        case "dsk.dskobj":
            return StepDskDskobj(op=op, path=_decode_path_ref(step.get("path"), label="dsk.dskobj.path"),
                cellSize=_expect_int(step.get("cellSize",10000),label="dsk.dskobj.cellSize"),
                initial=_expect_int_list(step.get("initial",[]),label="dsk.dskobj.initial"),
                repetitions=_expect_int(step.get("repetitions",1),label="dsk.dskobj.repetitions"))

        case "dsk.dsksrf":
            return StepDskDsksrf(
                op=op,
                path=_decode_path_ref(step.get("path"), label="dsk.dsksrf.path"),
                bodyid=_expect_int(step.get("bodyid"), label="dsk.dsksrf.bodyid"),
                cellSize=_expect_int(step.get("cellSize",10000),label="dsk.dsksrf.cellSize"),
                initial=_expect_int_list(step.get("initial",[]),label="dsk.dsksrf.initial"),
                repetitions=_expect_int(step.get("repetitions",1),label="dsk.dsksrf.repetitions"),
            )

        case "dsk.dskopn":
            return StepDskDskopn(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dskopn.handleId"),
                path=_decode_path_ref(step.get("path"), label="dsk.dskopn.path"),
                ifname=_expect_string(step.get("ifname"), label="dsk.dskopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="dsk.dskopn.ncomch"),
            )

        case "dsk.dskmi2":
            return StepDskDskmi2(
                op=op,
                spatialIndexId=_expect_string(step.get("spatialIndexId"), label="dsk.dskmi2.spatialIndexId"),
                vrtces=_expect_vec3_rows(step.get("vrtces"), label="dsk.dskmi2.vrtces"),
                plates=_expect_index_triples(step.get("plates"), label="dsk.dskmi2.plates"),
                finscl=_expect_number(step.get("finscl"), label="dsk.dskmi2.finscl"),
                corscl=_expect_int(step.get("corscl"), label="dsk.dskmi2.corscl"),
                worksz=_expect_int(step.get("worksz"), label="dsk.dskmi2.worksz"),
                voxpsz=_expect_int(step.get("voxpsz"), label="dsk.dskmi2.voxpsz"),
                voxlsz=_expect_int(step.get("voxlsz"), label="dsk.dskmi2.voxlsz"),
                makvtl=_expect_bool(step.get("makvtl"), label="dsk.dskmi2.makvtl"),
                spxisz=_expect_int(step.get("spxisz"), label="dsk.dskmi2.spxisz"),
            )

        case "dsk.dskw02":
            corpar = _expect_number_list(step.get("corpar"), label="dsk.dskw02.corpar")
            if len(corpar) != 10:
                raise ValueError("dsk.dskw02.corpar must have length 10")

            return StepDskDskw02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dskw02.handleId"),
                spatialIndexId=_expect_string(step.get("spatialIndexId"), label="dsk.dskw02.spatialIndexId"),
                center=_expect_int(step.get("center"), label="dsk.dskw02.center"),
                surfid=_expect_int(step.get("surfid"), label="dsk.dskw02.surfid"),
                dclass=_expect_int(step.get("dclass"), label="dsk.dskw02.dclass"),
                frame=_expect_string(step.get("frame"), label="dsk.dskw02.frame"),
                corsys=_expect_int(step.get("corsys"), label="dsk.dskw02.corsys"),
                corpar=corpar,
                mncor1=_expect_number(step.get("mncor1"), label="dsk.dskw02.mncor1"),
                mxcor1=_expect_number(step.get("mxcor1"), label="dsk.dskw02.mxcor1"),
                mncor2=_expect_number(step.get("mncor2"), label="dsk.dskw02.mncor2"),
                mxcor2=_expect_number(step.get("mxcor2"), label="dsk.dskw02.mxcor2"),
                mncor3=_expect_number(step.get("mncor3"), label="dsk.dskw02.mncor3"),
                mxcor3=_expect_number(step.get("mxcor3"), label="dsk.dskw02.mxcor3"),
                first=_expect_number(step.get("first"), label="dsk.dskw02.first"),
                last=_expect_number(step.get("last"), label="dsk.dskw02.last"),
                vrtces=_expect_vec3_rows(step.get("vrtces"), label="dsk.dskw02.vrtces"),
                plates=_expect_index_triples(step.get("plates"), label="dsk.dskw02.plates"),
            )

        case "dsk.dasopr":
            return StepDskDasopr(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dasopr.handleId"),
                path=_decode_path_ref(step.get("path"), label="dsk.dasopr.path"),
            )

        case "dsk.dascls":
            return StepDskDascls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dascls.handleId"),
            )

        case "dsk.dlabfs":
            return StepDskDlabfs(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dlabfs.handleId"),
                dladscId=_expect_string(step.get("dladscId"), label="dsk.dlabfs.dladscId"),
            )

        case "dsk.dskgd":
            return StepDskDskgd(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dskgd.handleId"),
                dladscId=_expect_string(step.get("dladscId"), label="dsk.dskgd.dladscId"),
            )

        case "dsk.dskb02":
            return StepDskDskb02(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="dsk.dskb02.handleId"),
                dladscId=_expect_string(step.get("dladscId"), label="dsk.dskb02.dladscId"),
            )

        case "geometry.subpnt":
            return StepGeometrySubpnt(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.subpnt.method"),
                target=_expect_string(step.get("target"), label="geometry.subpnt.target"),
                et=_expect_number(step.get("et"), label="geometry.subpnt.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.subpnt.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.subpnt.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.subpnt.observer"),
            )

        case "geometry.subslr":
            return StepGeometrySubslr(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.subslr.method"),
                target=_expect_string(step.get("target"), label="geometry.subslr.target"),
                et=_expect_number(step.get("et"), label="geometry.subslr.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.subslr.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.subslr.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.subslr.observer"),
            )

        case "geometry.sincpt":
            return StepGeometrySincpt(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.sincpt.method"),
                target=_expect_string(step.get("target"), label="geometry.sincpt.target"),
                et=_expect_number(step.get("et"), label="geometry.sincpt.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.sincpt.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.sincpt.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.sincpt.observer"),
                dref=_expect_string(step.get("dref"), label="geometry.sincpt.dref"),
                dvec=_expect_vec3(step.get("dvec"), label="geometry.sincpt.dvec"),
            )

        case "geometry.ilumin":
            return StepGeometryIlumin(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.ilumin.method"),
                target=_expect_string(step.get("target"), label="geometry.ilumin.target"),
                et=_expect_number(step.get("et"), label="geometry.ilumin.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.ilumin.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.ilumin.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.ilumin.observer"),
                spoint=_expect_vec3(step.get("spoint"), label="geometry.ilumin.spoint"),
            )

        case "geometry.illumg":
            return StepGeometryIllumg(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.illumg.method"),
                target=_expect_string(step.get("target"), label="geometry.illumg.target"),
                ilusrc=_expect_string(step.get("ilusrc"), label="geometry.illumg.ilusrc"),
                et=_expect_number(step.get("et"), label="geometry.illumg.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.illumg.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.illumg.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.illumg.observer"),
                spoint=_expect_vec3(step.get("spoint"), label="geometry.illumg.spoint"),
            )

        case "geometry.illumf":
            return StepGeometryIllumf(
                op=op,
                method=_expect_string(step.get("method"), label="geometry.illumf.method"),
                target=_expect_string(step.get("target"), label="geometry.illumf.target"),
                ilusrc=_expect_string(step.get("ilusrc"), label="geometry.illumf.ilusrc"),
                et=_expect_number(step.get("et"), label="geometry.illumf.et"),
                fixref=_expect_string(step.get("fixref"), label="geometry.illumf.fixref"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.illumf.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.illumf.observer"),
                spoint=_expect_vec3(step.get("spoint"), label="geometry.illumf.spoint"),
            )

        case "geometry.occult":
            return StepGeometryOccult(
                op=op,
                targ1=_expect_string(step.get("targ1"), label="geometry.occult.targ1"),
                shape1=_expect_string(step.get("shape1"), label="geometry.occult.shape1"),
                frame1=_expect_string(step.get("frame1"), label="geometry.occult.frame1"),
                targ2=_expect_string(step.get("targ2"), label="geometry.occult.targ2"),
                shape2=_expect_string(step.get("shape2"), label="geometry.occult.shape2"),
                frame2=_expect_string(step.get("frame2"), label="geometry.occult.frame2"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry.occult.abcorr"),
                observer=_expect_string(step.get("observer"), label="geometry.occult.observer"),
                et=_expect_number(step.get("et"), label="geometry.occult.et"),
            )

        case "geometry.nvc2pl":
            return StepGeometryNvc2pl(
                op=op,
                normal=_expect_vec3(step.get("normal"), label="geometry.nvc2pl.normal"),
                konst=_expect_number(step.get("konst"), label="geometry.nvc2pl.konst"),
            )

        case "geometry.pl2nvc":
            return StepGeometryPl2nvc(
                op=op,
                plane=_expect_vec4(step.get("plane"), label="geometry.pl2nvc.plane"),
            )

        case "geometry-gf.gfsstp":
            return StepGeometryGfGfsstp(
                op=op,
                step=_expect_number(step.get("step"), label="geometry-gf.gfsstp.step"),
            )

        case "geometry-gf.gfstep":
            return StepGeometryGfGfstep(
                op=op,
                time=_expect_number(step.get("time"), label="geometry-gf.gfstep.time"),
            )

        case "geometry-gf.gfstol":
            return StepGeometryGfGfstol(
                op=op,
                value=_expect_number(step.get("value"), label="geometry-gf.gfstol.value"),
            )

        case "geometry-gf.gfrefn":
            return StepGeometryGfGfrefn(
                op=op,
                t1=_expect_number(step.get("t1"), label="geometry-gf.gfrefn.t1"),
                t2=_expect_number(step.get("t2"), label="geometry-gf.gfrefn.t2"),
                s1=_expect_bool(step.get("s1"), label="geometry-gf.gfrefn.s1"),
                s2=_expect_bool(step.get("s2"), label="geometry-gf.gfrefn.s2"),
            )

        case "geometry-gf.gfrepi":
            return StepGeometryGfGfrepi(
                op=op,
                windowId=_expect_string(step.get("windowId"), label="geometry-gf.gfrepi.windowId"),
                begmss=_expect_string(step.get("begmss"), label="geometry-gf.gfrepi.begmss"),
                endmss=_expect_string(step.get("endmss"), label="geometry-gf.gfrepi.endmss"),
            )

        case "geometry-gf.gfrepf":
            return StepGeometryGfGfrepf(op=op)

        case "geometry-gf.gfsep":
            return StepGeometryGfGfsep(
                op=op,
                targ1=_expect_string(step.get("targ1"), label="geometry-gf.gfsep.targ1"),
                shape1=_expect_string(step.get("shape1"), label="geometry-gf.gfsep.shape1"),
                frame1=_expect_string(step.get("frame1"), label="geometry-gf.gfsep.frame1"),
                targ2=_expect_string(step.get("targ2"), label="geometry-gf.gfsep.targ2"),
                shape2=_expect_string(step.get("shape2"), label="geometry-gf.gfsep.shape2"),
                frame2=_expect_string(step.get("frame2"), label="geometry-gf.gfsep.frame2"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry-gf.gfsep.abcorr"),
                obsrvr=_expect_string(step.get("obsrvr"), label="geometry-gf.gfsep.obsrvr"),
                relate=_expect_string(step.get("relate"), label="geometry-gf.gfsep.relate"),
                refval=_expect_number(step.get("refval"), label="geometry-gf.gfsep.refval"),
                adjust=_expect_number(step.get("adjust"), label="geometry-gf.gfsep.adjust"),
                step=_expect_number(step.get("step"), label="geometry-gf.gfsep.step"),
                nintvls=_expect_int(step.get("nintvls"), label="geometry-gf.gfsep.nintvls"),
                cnfineWindowId=_expect_string(
                    step.get("cnfineWindowId"),
                    label="geometry-gf.gfsep.cnfineWindowId",
                ),
                resultMaxIntervals=(_expect_int(step.get("resultMaxIntervals"),label="geometry-gf.gfsep.resultMaxIntervals") if step.get("resultMaxIntervals") is not None else None),
                resultWindowId=_expect_string(
                    step.get("resultWindowId"),
                    label="geometry-gf.gfsep.resultWindowId",
                ),
            )

        case "geometry-gf.gfdist":
            return StepGeometryGfGfdist(
                op=op,
                target=_expect_string(step.get("target"), label="geometry-gf.gfdist.target"),
                abcorr=_expect_string(step.get("abcorr"), label="geometry-gf.gfdist.abcorr"),
                obsrvr=_expect_string(step.get("obsrvr"), label="geometry-gf.gfdist.obsrvr"),
                relate=_expect_string(step.get("relate"), label="geometry-gf.gfdist.relate"),
                refval=_expect_number(step.get("refval"), label="geometry-gf.gfdist.refval"),
                adjust=_expect_number(step.get("adjust"), label="geometry-gf.gfdist.adjust"),
                step=_expect_number(step.get("step"), label="geometry-gf.gfdist.step"),
                nintvls=_expect_int(step.get("nintvls"), label="geometry-gf.gfdist.nintvls"),
                cnfineWindowId=_expect_string(
                    step.get("cnfineWindowId"),
                    label="geometry-gf.gfdist.cnfineWindowId",
                ),
                resultMaxIntervals=(_expect_int(step.get("resultMaxIntervals"),label="geometry-gf.gfdist.resultMaxIntervals") if step.get("resultMaxIntervals") is not None else None),
                resultWindowId=_expect_string(
                    step.get("resultWindowId"),
                    label="geometry-gf.gfdist.resultWindowId",
                ),
            )

        case _:
            raise ValueError(f"Unsupported workflow op: {op}")


def decode_case_request(raw: Any) -> CaseRequest:
    root = _expect_mapping(raw, label="request")
    case_id = _expect_string(root.get("caseId"), label="request.caseId")
    workflow_raw = root.get("workflow")
    if not isinstance(workflow_raw, list):
        raise TypeError("request.workflow must be an array")

    runtime = _decode_runtime_config(root.get("runtime"))
    workflow = [_decode_step(item) for item in workflow_raw]
    return CaseRequest(caseId=case_id, workflow=workflow, runtime=runtime)
