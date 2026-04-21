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
    StepIdsNamesBodn2c,
    StepKernelPoolGcpool,
    StepKernelsFurnsh,
    StepKernelsKdata,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepTimeEt2Utc,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
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

        case "kernel-pool.gcpool":
            return StepKernelPoolGcpool(
                op=op,
                name=_expect_string(step.get("name"), label="kernel-pool.gcpool.name"),
                start=_expect_int(step.get("start"), label="kernel-pool.gcpool.start"),
                room=_expect_int(step.get("room"), label="kernel-pool.gcpool.room"),
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
