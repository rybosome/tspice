from __future__ import annotations

from typing import Any, Mapping

from .models import (
    CaseRequest,
    StepCellsWindowsWnfetd,
    StepCellsWindowsWninsd,
    StepCoordsVectorsMxm,
    StepCoordsVectorsRecgeo,
    StepEkEkgc,
    StepEkEkfind,
    StepErrorChkin,
    StepErrorChkout,
    StepErrorFailed,
    StepErrorGetmsg,
    StepErrorReset,
    StepErrorSetmsg,
    StepErrorSigerr,
    StepIdsNamesBodn2c,
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
    StepKernelsFurnsh,
    StepKernelsKdata,
    StepKernelsKtotal,
    StepKernelsKxtrct,
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

        case "coords-vectors.mxm":
            return StepCoordsVectorsMxm(
                op=op,
                m1=_expect_3x3_matrix(step.get("m1"), label="coords-vectors.mxm.m1"),
                m2=_expect_3x3_matrix(step.get("m2"), label="coords-vectors.mxm.m2"),
            )

        case "coords-vectors.recgeo":
            return StepCoordsVectorsRecgeo(
                op=op,
                rectan=_expect_vec3(step.get("rectan"), label="coords-vectors.recgeo.rectan"),
                re=_expect_number(step.get("re"), label="coords-vectors.recgeo.re"),
                f=_expect_number(step.get("f"), label="coords-vectors.recgeo.f"),
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
            return StepKernelsFurnsh(op=op, file=_expect_string(step.get("file"), label="kernels.furnsh.file"))

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

        case "ek.ekgc":
            return StepEkEkgc(
                op=op,
                selidx=_expect_int(step.get("selidx"), label="ek.ekgc.selidx"),
                row=_expect_int(step.get("row"), label="ek.ekgc.row"),
                elment=_expect_int(step.get("elment"), label="ek.ekgc.elment"),
            )

        case _:
            raise ValueError(f"Unsupported workflow op: {op}")


def decode_case_request(raw: Any) -> CaseRequest:
    root = _expect_mapping(raw, label="request")
    case_id = _expect_string(root.get("caseId"), label="request.caseId")
    workflow_raw = root.get("workflow")
    if not isinstance(workflow_raw, list):
        raise TypeError("request.workflow must be an array")

    workflow = [_decode_step(item) for item in workflow_raw]
    return CaseRequest(caseId=case_id, workflow=workflow)
