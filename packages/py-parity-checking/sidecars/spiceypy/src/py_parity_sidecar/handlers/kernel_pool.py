from __future__ import annotations

from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import StepKernelPoolGcpool, StepOutput, WorkflowStep


def _normalize_found_list(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2 and isinstance(value[1], (bool, int)):
            values_raw, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {"found": True, "values": [str(item) for item in values_raw]}
    return {"found": True, "values": [str(item) for item in value]}


def run_kernel_pool_step(step: WorkflowStep) -> StepOutput | None:
    if not isinstance(step, StepKernelPoolGcpool):
        return None

    try:
        out = _normalize_found_list(sp.gcpool(step.name, step.start, step.room))
        return StepOutput(op=step.op, value=out)
    except NotFoundError:
        return StepOutput(op=step.op, value={"found": False})
