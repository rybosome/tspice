from __future__ import annotations

from ..models import CaseRequest, StepOutput, WorkflowStep
from .cells_windows import WindowStore, run_cells_windows_step
from .coords_vectors import run_coords_vectors_step
from .ek import run_ek_step
from .ids_names import run_ids_names_step
from .kernel_pool import run_kernel_pool_step
from .kernels import run_kernels_step
from .time import run_time_step


def _run_step(step: WorkflowStep, windows: WindowStore) -> StepOutput:
    out = run_time_step(step)
    if out is not None:
        return out

    out = run_ids_names_step(step)
    if out is not None:
        return out

    out = run_coords_vectors_step(step)
    if out is not None:
        return out

    out = run_cells_windows_step(step, windows)
    if out is not None:
        return out

    out = run_kernel_pool_step(step)
    if out is not None:
        return out

    out = run_kernels_step(step)
    if out is not None:
        return out

    out = run_ek_step(step)
    if out is not None:
        return out

    raise TypeError(f"Unsupported step type: {type(step)}")


def run_workflow(req: CaseRequest) -> list[StepOutput]:
    windows: WindowStore = {}
    outputs: list[StepOutput] = []
    for step in req.workflow:
        outputs.append(_run_step(step, windows))
    return outputs
