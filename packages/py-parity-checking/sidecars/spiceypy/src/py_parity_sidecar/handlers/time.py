from __future__ import annotations

import spiceypy as sp

from ..models import (
    StepOutput,
    StepTimeEt2Utc,
    StepTimeStr2Et,
    StepTimeTimdefGet,
    StepTimeTimdefSet,
    WorkflowStep,
)


def run_time_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepTimeStr2Et):
        et = float(sp.str2et(step.time))
        return StepOutput(op=step.op, value=et)

    if isinstance(step, StepTimeEt2Utc):
        utc = str(sp.et2utc(step.et, step.format, step.prec))
        return StepOutput(op=step.op, value=utc)

    if isinstance(step, StepTimeTimdefGet):
        value = sp.timdef("GET", step.item, 256)
        return StepOutput(op=step.op, value=str(value))

    if isinstance(step, StepTimeTimdefSet):
        sp.timdef("SET", step.item, 256, step.value)
        return StepOutput(op=step.op, value=None)

    return None
