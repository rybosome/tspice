from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import (
    StepIdsNamesBodc2n,
    StepIdsNamesBodc2s,
    StepIdsNamesBoddef,
    StepIdsNamesBodfnd,
    StepIdsNamesBodn2c,
    StepIdsNamesBods2c,
    StepIdsNamesBodvar,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext

_MAX_BOD_ITEM_CHARS = 1024


def _normalize_found_code(value: Any, *, label: str) -> dict[str, int | bool]:
    if isinstance(value, tuple):
        if len(value) == 2:
            code_raw, found_raw = value
            found = bool(found_raw)
            if found:
                return {"found": True, "code": int(code_raw)}
            return {"found": False}
        raise ValueError(f"Unexpected {label} tuple shape: {value!r}")
    return {"found": True, "code": int(value)}


def _normalize_bodc2n(value: Any) -> dict[str, str | bool]:
    if isinstance(value, tuple):
        if len(value) == 2:
            name_raw, found_raw = value
            found = bool(found_raw)
            if found:
                return {"found": True, "name": str(name_raw)}
            return {"found": False}
        raise ValueError(f"Unexpected bodc2n tuple shape: {value!r}")
    return {"found": True, "name": str(value)}


def _is_ascii_whitespace(ch: str) -> bool:
    return ch in {" ", "\t", "\n", "\r", "\f", "\v"}


def _trim_ascii_whitespace(value: str) -> str:
    start = 0
    end = len(value)

    while start < end and _is_ascii_whitespace(value[start]):
        start += 1

    while end > start and _is_ascii_whitespace(value[end - 1]):
        end -= 1

    return value[start:end]


def _to_ascii_uppercase(value: str) -> str:
    out: list[str] | None = None

    for idx, ch in enumerate(value):
        if "a" <= ch <= "z":
            if out is None:
                out = list(value[:idx])
            out.append(chr(ord(ch) - 32))
        elif out is not None:
            out.append(ch)

    if out is None:
        return value
    return "".join(out)


def _normalize_bod_item(item: str) -> str:
    if len(item) > _MAX_BOD_ITEM_CHARS:
        raise ValueError(
            f"Kernel pool item name is too long: {len(item)} characters (max {_MAX_BOD_ITEM_CHARS})"
        )
    return _to_ascii_uppercase(_trim_ascii_whitespace(item))


def _lookup_body_pool_entry(body: int, item: str) -> tuple[int, str] | None:
    pool_var = f"BODY{body}_{item}"

    try:
        dtpool_out = sp.dtpool(pool_var)
    except NotFoundError:
        return None

    if isinstance(dtpool_out, tuple):
        if len(dtpool_out) == 3:
            size_raw, type_raw, found_raw = dtpool_out
            if not bool(found_raw):
                return None
            return int(size_raw), str(type_raw)

        if len(dtpool_out) == 2:
            size_raw, type_raw = dtpool_out
            return int(size_raw), str(type_raw)

    raise ValueError(f"Unexpected dtpool return shape: {dtpool_out!r}")


def _normalize_numeric_values(value: Any, *, max_size: int) -> list[float]:
    if max_size <= 0:
        return []

    raw_list: list[Any]
    if hasattr(value, "tolist"):
        as_list = value.tolist()
        if isinstance(as_list, list):
            raw_list = as_list
        else:
            raw_list = [as_list]
    elif isinstance(value, tuple):
        raw_list = list(value)
    elif isinstance(value, list):
        raw_list = value
    else:
        raw_list = [value]

    return [float(item) for item in raw_list[:max_size]]


def run_ids_names_step(step: WorkflowStep, _context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepIdsNamesBodn2c):
        try:
            out = _normalize_found_code(sp.bodn2c(step.name), label="bodn2c")
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepIdsNamesBodc2n):
        try:
            out = _normalize_bodc2n(sp.bodc2n(step.code))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepIdsNamesBodc2s):
        out = str(sp.bodc2s(step.code))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepIdsNamesBods2c):
        try:
            out = _normalize_found_code(sp.bods2c(step.name), label="bods2c")
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepIdsNamesBoddef):
        sp.boddef(step.name, step.code)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepIdsNamesBodfnd):
        normalized_item = _normalize_bod_item(step.item)
        found = _lookup_body_pool_entry(step.body, normalized_item) is not None
        return StepOutput(op=step.op, value=found)

    if isinstance(step, StepIdsNamesBodvar):
        normalized_item = _normalize_bod_item(step.item)
        pool_entry = _lookup_body_pool_entry(step.body, normalized_item)
        if pool_entry is None:
            return StepOutput(op=step.op, value=[])

        size, var_type = pool_entry
        if var_type != "N" or size <= 0:
            return StepOutput(op=step.op, value=[])

        out = sp.bodvar(step.body, normalized_item, size)
        return StepOutput(op=step.op, value=_normalize_numeric_values(out, max_size=size))

    return None
