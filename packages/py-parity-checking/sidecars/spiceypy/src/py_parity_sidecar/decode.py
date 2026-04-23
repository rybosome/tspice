from __future__ import annotations

from typing import Any, Mapping

from .models import (
    CaseRequest,
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
    StepEkEkgc,
    StepEkEkfind,
    StepFileIoDafbfs,
    StepFileIoDafcls,
    StepFileIoDaffna,
    StepFileIoDafopr,
    StepFileIoDascls,
    StepFileIoDasopr,
    StepFileIoDlabfs,
    StepFileIoDlacls,
    StepFileIoDlafns,
    StepFileIoDlaopn,
    StepFileIoDskmi2,
    StepFileIoDskopn,
    StepFileIoDskw02,
    StepFileIoExists,
    StepFileIoGetfat,
    StepErrorChkin,
    StepErrorChkout,
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
    StepFramesCklpf,
    StepFramesCkobj,
    StepFramesCkupf,
    StepFramesCnmfrm,
    StepFramesFrinfo,
    StepFramesFrmnam,
    StepFramesNamfrm,
    StepFramesPxform,
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
    StepIdsNamesBodn2c,
    StepIdsNamesBods2c,
    StepIdsNamesBodvar,
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
    StepTimeSce2c,
    StepTimeSce2s,
    StepTimeScs2e,
    StepTimeSct2e,
    StepTimeStr2Et,
    StepTimeTimout,
    StepTimeTkvrsn,
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


def _decode_step(raw_step: Any) -> WorkflowStep:
    step = _expect_mapping(raw_step, label="workflow step")
    op = _expect_string(step.get("op"), label="workflow step.op")

    match op:
        case "time.str2et":
            return StepTimeStr2Et(op=op, time=_expect_string(step.get("time"), label="time.str2et.time"))

        case "time.et2utc":
            return StepTimeEt2Utc(
                op=op,
                et=_expect_number(step.get("et"), label="time.et2utc.et"),
                format=_expect_string(step.get("format"), label="time.et2utc.format"),
                prec=_expect_int(step.get("prec"), label="time.et2utc.prec"),
            )

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
            if item not in {"SYSTEM", "CALENDAR", "ZONE"}:
                raise ValueError("time.timdef.item must be SYSTEM|CALENDAR|ZONE")
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

        case "time.sce2c":
            return StepTimeSce2c(
                op=op,
                sc=_expect_int(step.get("sc"), label="time.sce2c.sc"),
                et=_expect_number(step.get("et"), label="time.sce2c.et"),
            )

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

        case "cells-windows.wnvald":
            return StepCellsWindowsWnvald(
                op=op,
                size=_expect_int(step.get("size"), label="cells-windows.wnvald.size"),
                n=_expect_int(step.get("n"), label="cells-windows.wnvald.n"),
                windowId=_expect_string(step.get("windowId"), label="cells-windows.wnvald.windowId"),
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
            return StepKernelsKplfrm(op=op, frmcls=_expect_int(step.get("frmcls"), label="kernels.kplfrm.frmcls"))

        case "kernels.ktotal":
            return StepKernelsKtotal(op=op, kind=_expect_string(step.get("kind"), label="kernels.ktotal.kind"))

        case "kernels.kdata":
            return StepKernelsKdata(
                op=op,
                which=_expect_int(step.get("which"), label="kernels.kdata.which"),
                kind=_expect_string(step.get("kind"), label="kernels.kdata.kind"),
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
            )

        case "frames.pxform":
            return StepFramesPxform(
                op=op,
                from_=_expect_string(step.get("from"), label="frames.pxform.from"),
                to=_expect_string(step.get("to"), label="frames.pxform.to"),
                et=_expect_number(step.get("et"), label="frames.pxform.et"),
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

        case "ek.ekgc":
            return StepEkEkgc(
                op=op,
                selidx=_expect_int(step.get("selidx"), label="ek.ekgc.selidx"),
                row=_expect_int(step.get("row"), label="ek.ekgc.row"),
                elment=_expect_int(step.get("elment"), label="ek.ekgc.elment"),
            )

        case "dsk.dskobj":
            return StepDskDskobj(op=op, path=_decode_path_ref(step.get("path"), label="dsk.dskobj.path"))

        case "dsk.dsksrf":
            return StepDskDsksrf(
                op=op,
                path=_decode_path_ref(step.get("path"), label="dsk.dsksrf.path"),
                bodyid=_expect_int(step.get("bodyid"), label="dsk.dsksrf.bodyid"),
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
