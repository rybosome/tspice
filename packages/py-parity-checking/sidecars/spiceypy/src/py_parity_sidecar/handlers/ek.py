from __future__ import annotations

from typing import Any

import spiceypy as sp

from ..models import StepEkEkgc, StepEkEkfind, StepOutput, WorkflowStep


def _normalize_ekgc(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 2:
            text, is_null_raw = value
            is_null = bool(is_null_raw)
            if is_null:
                return {"found": True, "isNull": True}
            return {"found": True, "isNull": False, "value": str(text)}
        if len(value) == 3:
            first, second, third = value
            if isinstance(third, (bool, int)):
                found = bool(third)
                if not found:
                    return {"found": False}
                is_null = bool(first)
                if is_null:
                    return {"found": True, "isNull": True}
                return {"found": True, "isNull": False, "value": str(second)}
    raise ValueError(f"Unexpected ekgc return shape: {value!r}")


def run_ek_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepEkEkfind):
        nmrows, error_flag, errmsg = sp.ekfind(step.query)
        if int(error_flag) == 0:
            return StepOutput(op=step.op, value={"ok": True, "nmrows": int(nmrows)})
        return StepOutput(op=step.op, value={"ok": False, "errmsg": str(errmsg)})

    if isinstance(step, StepEkEkgc):
        out = _normalize_ekgc(sp.ekgc(step.selidx, step.row, step.elment))
        return StepOutput(op=step.op, value=out)

    return None
