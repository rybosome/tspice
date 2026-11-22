from __future__ import annotations

from typing import Any
import spiceypy as sp
from spiceypy.utils.callbacks import SpiceUDBAIL, SpiceUDREFN, SpiceUDREPF, SpiceUDREPU, SpiceUDSTEP, UDREPI
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
from ..models import StepGeometryGfConfigured, StepOutput


def _intervals(window: Any) -> list[list[float]]:
    return [list(map(float, sp.wnfetd(window, index))) for index in range(sp.wncard(window))]


def run_configured_gf(step: StepGeometryGfConfigured, confinement: Any, result: Any) -> StepOutput:
    events: list[dict[str, Any]] = []
    bail_calls = 0
    interrupted = False

    @SpiceUDSTEP
    def step_size(epoch: float) -> float:
        events.append({"kind": "step", "epoch": epoch})
        return step.stepSeconds

    @SpiceUDREFN
    def refine(first: float, second: float, at_first: int, at_second: int) -> float:
        events.append({"kind": "refine", "first": first, "second": second,
                       "stateAtFirst": bool(at_first), "stateAtSecond": bool(at_second)})
        return (first + second) / 2

    @UDREPI
    def report_start(cell: Any, prefix: bytes, suffix: bytes) -> None:
        events.append({"kind": "reportStart", "confinementEndpoints": list(cell.contents),
                       "prefix": prefix.decode("utf-8"), "suffix": suffix.decode("utf-8")})

    @SpiceUDREPU
    def report_update(start: float, end: float, epoch: float) -> None:
        events.append({"kind": "reportUpdate", "intervalStart": start, "intervalEnd": end, "epoch": epoch})

    @SpiceUDREPF
    def report_end() -> None:
        events.append({"kind": "reportEnd"})

    @SpiceUDBAIL
    def bail() -> bool:
        nonlocal bail_calls, interrupted
        bail_calls += 1
        interrupted = step.bailAfter is not None and bail_calls >= step.bailAfter
        events.append({"kind": "bail"})
        return interrupted

    search = step.search
    report = search.get("report", False)
    allow_bail = search.get("bail", False)
    candidate = SPICEDOUBLE_CELL(result.size)
    progress = (report, report_start, report_update, report_end)
    suffix = (allow_bail, bail, confinement, candidate)
    if step.op == "geometry-gf.gfevnt":
        parameters = search["parameters"]
        names = [row["name"] for row in parameters]
        texts = [row.get("text", "") for row in parameters]
        width = max([2, *(len(text.encode("utf-8")) + 1 for text in names + texts)])
        sp.gfevnt(step_size, refine, search["quantity"], len(parameters), width, names, texts,
                  [row.get("real", 0.) for row in parameters], [row.get("integer", 0) for row in parameters],
                  [int(row.get("logical", False)) for row in parameters], search["relation"], search["reference"],
                  search["tolerance"], search["adjustment"], *progress, search["workspaceIntervals"], *suffix)
    elif step.op == "geometry-gf.gffove":
        fields = ("instrument", "shape", "ray", "target", "frame", "aberration", "observer", "tolerance")
        sp.gffove(*(search[key] for key in fields), step_size, refine, *progress, *suffix)
    else:
        fields = ("occultation", "front", "frontShape", "frontFrame", "back", "backShape", "backFrame", "aberration", "observer", "tolerance")
        sp.gfocce(*(search[key] for key in fields), step_size, refine, *progress, *suffix)

    if not interrupted:
        sp.scard(0, result)
        for left, right in _intervals(candidate):
            sp.wninsd(left, right, result)
    return StepOutput(op=step.op, value={"intervals": _intervals(result),
                                        "confinementIntervals": _intervals(confinement),
                                        "callbacks": events})
