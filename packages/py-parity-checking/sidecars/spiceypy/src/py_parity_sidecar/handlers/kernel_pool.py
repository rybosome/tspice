from __future__ import annotations

from typing import Any, Callable

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import (
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
    StepOutput,
    WorkflowStep,
)


def _normalize_found_scalars(
    value: Any,
    *,
    convert: Callable[[Any], Any],
) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2 and isinstance(value[1], (bool, int)):
            values_raw, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {"found": True, "values": [convert(item) for item in values_raw]}

    return {"found": True, "values": [convert(item) for item in value]}


def _normalize_dtpool(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 3 and isinstance(value[2], (bool, int)):
            n_raw, type_raw, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {"found": True, "n": int(n_raw), "type": str(type_raw)}

        if len(value) == 2:
            n_raw, type_raw = value
            return {"found": True, "n": int(n_raw), "type": str(type_raw)}

    raise ValueError(f"Unexpected dtpool return shape: {value!r}")


def _swpool_lenvals(names: list[str]) -> int:
    if len(names) == 0:
        return 2
    return max(2, max(len(name) for name in names))


def run_kernel_pool_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepKernelPoolGdpool):
        try:
            out = _normalize_found_scalars(
                sp.gdpool(step.name, step.start, step.room),
                convert=float,
            )
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelPoolGipool):
        try:
            out = _normalize_found_scalars(
                sp.gipool(step.name, step.start, step.room),
                convert=int,
            )
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelPoolGcpool):
        try:
            out = _normalize_found_scalars(
                sp.gcpool(step.name, step.start, step.room),
                convert=str,
            )
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelPoolGnpool):
        try:
            out = _normalize_found_scalars(
                sp.gnpool(step.template, step.start, step.room),
                convert=str,
            )
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelPoolDtpool):
        try:
            out = _normalize_dtpool(sp.dtpool(step.name))
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelPoolPdpool):
        sp.pdpool(step.name, step.values)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelPoolPipool):
        sp.pipool(step.name, step.values)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelPoolPcpool):
        sp.pcpool(step.name, step.values)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelPoolSwpool):
        if len(step.names) == 0:
            # SpiceyPy's wrapper computes max() over names even when nnames=0.
            # Provide an ignored placeholder while keeping nnames=0 to preserve CSPICE semantics.
            sp.swpool(step.agent, 0, 2, ["AA"])
        else:
            sp.swpool(step.agent, len(step.names), _swpool_lenvals(step.names), step.names)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelPoolCvpool):
        return StepOutput(op=step.op, value=bool(sp.cvpool(step.agent)))

    if isinstance(step, StepKernelPoolExpool):
        return StepOutput(op=step.op, value=bool(sp.expool(step.name)))

    return None
