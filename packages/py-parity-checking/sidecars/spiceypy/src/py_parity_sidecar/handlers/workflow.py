from __future__ import annotations

from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Mapping

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError

from ..models import CaseRequest, JsonValue, StepOutput, WorkflowStep

try:
    import numpy as np
except BaseException:  # pragma: no cover - defensive fallback only
    np = None


def _method_name_from_op(op: str) -> str:
    domain, sep, method = op.partition(".")
    if sep == "" or domain.strip() == "" or method.strip() == "":
        raise ValueError(f"Invalid canonical op key: {op}")
    return method


def _basename(path_value: str) -> str:
    if path_value.strip() == "":
        return ""
    return Path(path_value).name


def _normalize_json_value(value: Any) -> JsonValue:
    if value is None or isinstance(value, (str, bool, int, float)):
        return value

    if np is not None:
        if isinstance(value, np.generic):
            return _normalize_json_value(value.item())
        if isinstance(value, np.ndarray):
            return _normalize_json_value(value.tolist())

    if isinstance(value, Mapping):
        return {str(key): _normalize_json_value(nested) for key, nested in value.items()}

    if is_dataclass(value):
        return _normalize_json_value(asdict(value))

    if hasattr(value, "_asdict"):
        try:
            return _normalize_json_value(value._asdict())
        except BaseException:
            pass

    if isinstance(value, (list, tuple)):
        return [_normalize_json_value(item) for item in value]

    if isinstance(value, set):
        return [_normalize_json_value(item) for item in sorted(value, key=repr)]

    if hasattr(value, "tolist"):
        try:
            return _normalize_json_value(value.tolist())
        except BaseException:
            pass

    if hasattr(value, "item"):
        try:
            return _normalize_json_value(value.item())
        except BaseException:
            pass

    if hasattr(value, "__dict__"):
        return {
            str(key): _normalize_json_value(nested)
            for key, nested in vars(value).items()
            if not key.startswith("_")
        }

    return repr(value)


def _normalize_kdata(value: Any) -> JsonValue:
    if isinstance(value, tuple):
        if len(value) == 5:
            file, filtyp, source, _handle, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "file": _basename(str(file)),
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }
        if len(value) == 4:
            file, filtyp, source, _handle = value
            return {
                "found": True,
                "file": _basename(str(file)),
                "filtyp": str(filtyp),
                "source": _basename(str(source)),
            }

    raise ValueError(f"Unexpected kdata return shape: {value!r}")


def _normalize_method_output(method_name: str, value: Any) -> JsonValue:
    if method_name == "ccifrm":
        if isinstance(value, tuple) and len(value) == 3:
            frcode, frname, center = value
            return {
                "found": True,
                "frcode": int(frcode),
                "frname": str(frname),
                "center": int(center),
            }
        raise ValueError(f"Unexpected ccifrm return shape: {value!r}")

    if method_name == "cidfrm":
        if isinstance(value, tuple) and len(value) == 2:
            frcode, frname = value
            return {
                "found": True,
                "frcode": int(frcode),
                "frname": str(frname),
            }
        raise ValueError(f"Unexpected cidfrm return shape: {value!r}")

    if method_name == "frinfo":
        if isinstance(value, tuple) and len(value) == 3:
            center, frame_class, class_id = value
            return {
                "found": True,
                "center": int(center),
                "frameClass": int(frame_class),
                "classId": int(class_id),
            }
        raise ValueError(f"Unexpected frinfo return shape: {value!r}")

    if method_name == "frmnam":
        text = str(value)
        if text == "":
            return {"found": False}
        return {"found": True, "name": text}

    if method_name == "bodc2n":
        text = str(value)
        if text == "":
            return {"found": False}
        return {"found": True, "name": text}

    if method_name == "kdata":
        return _normalize_kdata(value)

    return _normalize_json_value(value)


def _run_step(step: WorkflowStep) -> StepOutput:
    method_name = _method_name_from_op(step.op)
    fn = getattr(sp, method_name, None)
    if not callable(fn):
        raise AttributeError(f"spiceypy has no callable for op {step.op} (method={method_name})")

    try:
        out = fn(*step.args)
    except NotFoundError:
        if method_name in {"ccifrm", "cidfrm", "frinfo", "bodc2n", "kdata"}:
            return StepOutput(op=step.op, value={"found": False})
        raise

    return StepOutput(op=step.op, value=_normalize_method_output(method_name, out))


def run_workflow(req: CaseRequest) -> list[StepOutput]:
    return [_run_step(step) for step in req.workflow]
