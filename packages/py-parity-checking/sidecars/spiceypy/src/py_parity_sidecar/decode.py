from __future__ import annotations

from typing import Any, Mapping

from .models import CaseRequest, WorkflowStep


def _expect_mapping(value: Any, *, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"{label} must be an object")
    return value


def _expect_string(value: Any, *, label: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{label} must be a string")
    return value


def _decode_step(raw_step: Any) -> WorkflowStep:
    step = _expect_mapping(raw_step, label="workflow step")
    op = _expect_string(step.get("op"), label="workflow step.op")

    args_raw = step.get("args", [])
    if not isinstance(args_raw, list):
        raise TypeError("workflow step.args must be an array when provided")

    return WorkflowStep(op=op, args=list(args_raw))


def decode_case_request(raw: Any) -> CaseRequest:
    root = _expect_mapping(raw, label="request")
    case_id = _expect_string(root.get("caseId"), label="request.caseId")
    workflow_raw = root.get("workflow")
    if not isinstance(workflow_raw, list):
        raise TypeError("request.workflow must be an array")

    workflow = [_decode_step(item) for item in workflow_raw]
    return CaseRequest(caseId=case_id, workflow=workflow)
