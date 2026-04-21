from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import StepIdsNamesBodn2c, StepOutput, WorkflowStep


def _normalize_bodn2c(value: Any) -> dict[str, int | bool]:
    if isinstance(value, tuple):
        if len(value) == 2:
            code_raw, found_raw = value
            found = bool(found_raw)
            if found:
                return {"found": True, "code": int(code_raw)}
            return {"found": False}
        raise ValueError(f"Unexpected bodn2c tuple shape: {value!r}")
    return {"found": True, "code": int(value)}


def run_ids_names_step(step: WorkflowStep) -> StepOutput | None:
    if not isinstance(step, StepIdsNamesBodn2c):
        return None

    try:
        out = _normalize_bodn2c(sp.bodn2c(step.name))
        return StepOutput(op=step.op, value=out)
    except NotFoundError:
        return StepOutput(op=step.op, value={"found": False})
