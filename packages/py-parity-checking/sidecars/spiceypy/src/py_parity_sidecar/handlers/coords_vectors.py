from __future__ import annotations

import spiceypy as sp

from ..models import StepCoordsVectorsMxm, StepCoordsVectorsRecgeo, StepOutput, WorkflowStep


def run_coords_vectors_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepCoordsVectorsMxm):
        out = sp.mxm(step.m1, step.m2)
        return StepOutput(op=step.op, value=[[float(v) for v in row] for row in out.tolist()])

    if isinstance(step, StepCoordsVectorsRecgeo):
        lon, lat, alt = sp.recgeo(step.rectan, step.re, step.f)
        return StepOutput(op=step.op, value={"lon": float(lon), "lat": float(lat), "alt": float(alt)})

    return None
