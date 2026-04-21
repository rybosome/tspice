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
    StepEkEkopn,
    StepEkEkopr,
    StepEkEkopw,
    StepEkEktnam,
    StepErrorChkin,
    StepErrorChkout,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
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

        case "ephemeris.spkcls":
            return StepEphemerisSpkcls(
                op=op,
                handleId=_expect_string(step.get("handleId"), label="ephemeris.spkcls.handleId"),
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
            return StepEphemerisSpkuds(
                op=op,
                descr=_expect_spk_packed_descriptor(step.get("descr"), label="ephemeris.spkuds.descr"),
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

        case "ek.ekfind":
            return StepEkEkfind(op=op, query=_expect_string(step.get("query"), label="ek.ekfind.query"))

        case "ek.ekopn":
            return StepEkEkopn(
                op=op,
                path=_expect_string(step.get("path"), label="ek.ekopn.path"),
                ifname=_expect_string(step.get("ifname"), label="ek.ekopn.ifname"),
                ncomch=_expect_int(step.get("ncomch"), label="ek.ekopn.ncomch"),
                handleId=_expect_string(step.get("handleId"), label="ek.ekopn.handleId"),
            )

        case "ek.ekopr":
            return StepEkEkopr(
                op=op,
                path=_expect_string(step.get("path"), label="ek.ekopr.path"),
                handleId=_expect_string(step.get("handleId"), label="ek.ekopr.handleId"),
            )

        case "ek.ekopw":
            return StepEkEkopw(
                op=op,
                path=_expect_string(step.get("path"), label="ek.ekopw.path"),
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
