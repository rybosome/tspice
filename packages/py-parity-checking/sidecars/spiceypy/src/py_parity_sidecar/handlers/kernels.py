from __future__ import annotations

import ctypes
from pathlib import Path
from typing import Any

import spiceypy as sp
from spiceypy.utils.exceptions import NotFoundError
from spiceypy.utils.support_types import SPICEINT_CELL

from ..models import (
    PathRefInput,
    StepKernelsFurnsh,
    StepKernelsKclear,
    StepKernelsKdata,
    StepKernelsKinfo,
    StepKernelsKplfrm,
    StepKernelsKtotal,
    StepKernelsKxtrct,
    StepKernelsUnload,
    StepOutput,
    WorkflowStep,
)
from ..runtime import SidecarRuntimeContext, resolve_path_ref, to_path_ref


def _metadata_path(context: SidecarRuntimeContext, value: str) -> str:
    if not value:
        return ""
    for root, prefix in [(context.paths.fixturesRoot, ""), (context.paths.scratchRoot, "scratch/")]:
        try:
            return prefix + str(Path(value).relative_to(root)).replace("\\", "/")
        except ValueError:
            pass
    return value


def _native_query(kind: str | list[str] | None) -> str | None:
    if kind is None:
        return "ALL"
    tokens = [t.strip().upper() for t in kind] if isinstance(kind, list) else kind.upper().split()
    allowed = {"ALL", "SPK", "CK", "PCK", "DSK", "TEXT", "EK", "META"}
    if tokens and all(t in allowed for t in tokens):
        if "ALL" in tokens:
            return "ALL"
        return " ".join(dict.fromkeys(tokens))
    return None


def _kind_entries(kind: str | list[str] | None) -> list[tuple]:
    # The public contract extends CSPICE selectors with filename subtypes and
    # arrays. Build the independent oracle from actual kdata/ktotal outputs.
    if kind is None:
        tokens = ["ALL"]
    elif isinstance(kind, list):
        tokens = [t.strip().upper() for t in kind]
    elif isinstance(kind, str):
        tokens = kind.upper().split()
    else:
        raise ValueError("invalid kernel kind")
    allowed = {"ALL", "SPK", "CK", "PCK", "DSK", "TEXT", "LSK", "FK", "IK", "SCLK", "EK", "META"}
    if not tokens or any(t not in allowed for t in tokens):
        raise ValueError("invalid kernel kind")
    suffixes = {".tls": "LSK", ".lsk": "LSK", ".tf": "FK", ".fk": "FK", ".ti": "IK", ".ik": "IK", ".tsc": "SCLK", ".sclk": "SCLK"}
    entries = []
    for index in range(sp.ktotal("ALL")):
        entry = sp.kdata(index, "ALL")
        file, filtyp = entry[0:2]
        subtype = suffixes.get(Path(file).suffix.lower(), "TEXT") if filtyp == "TEXT" else filtyp
        if "ALL" in tokens or filtyp in tokens or subtype in tokens:
            entries.append(entry)
    return entries


def _to_virtual_kernel_path(path_ref_input: PathRefInput) -> str:
    if isinstance(path_ref_input, str) and Path(path_ref_input).is_absolute():
        return f"py-parity/{Path(path_ref_input).name}"

    path_ref = to_path_ref(path_ref_input)
    if path_ref.kind == "fixture":
        return f"py-parity/{path_ref.rel}"
    return f"py-parity/scratch/{path_ref.rel}"


def _normalize_kinfo(value: Any, context: SidecarRuntimeContext, filename: str) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 4 and isinstance(value[3], (bool, int)):
            filtyp, source, _handle, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "filtyp": str(filtyp),
                "source": _metadata_path(context, str(source)),
                "handleIsZero": int(_handle) == 0,
                "handleMatchesEntry": any(str(e[0]) == filename and int(e[3]) == int(_handle) for e in _kind_entries("ALL")),
            }
        if len(value) == 3:
            filtyp, source, _handle = value
            return {
                "found": True,
                "filtyp": str(filtyp),
                "source": _metadata_path(context, str(source)),
                "handleIsZero": int(_handle) == 0,
                "handleMatchesEntry": any(str(e[0]) == filename and int(e[3]) == int(_handle) for e in _kind_entries("ALL")),
            }
    raise ValueError(f"Unexpected kinfo return shape: {value!r}")


def _normalize_kdata(value: Any, context: SidecarRuntimeContext) -> dict[str, Any]:
    if isinstance(value, tuple):
        if len(value) == 5:
            file, filtyp, source, _handle, found_raw = value
            found = bool(found_raw)
            if not found:
                return {"found": False}
            return {
                "found": True,
                "file": _metadata_path(context, str(file)),
                "filtyp": str(filtyp),
                "source": _metadata_path(context, str(source)),
                "handleIsZero": int(_handle) == 0,
            }
        if len(value) == 4:
            file, filtyp, source, _handle = value
            return {
                "found": True,
                "file": _metadata_path(context, str(file)),
                "filtyp": str(filtyp),
                "source": _metadata_path(context, str(source)),
                "handleIsZero": int(_handle) == 0,
            }
    raise ValueError(f"Unexpected kdata return shape: {value!r}")


def _normalize_kplfrm(value: Any) -> dict[str, Any]:
    return {"ids": sorted(int(item) for item in value)}


def _ek_files(context):
    if context.state.ek.lastSuccessfulFindNmrows is None and not context.state.ek.loads:
        return ()
    return tuple(sp.kdata(i,"EK")[3] for i in range(sp.ktotal("EK")))


def _changed_ek_files(context, prior):
    current = _ek_files(context)
    if current == prior:
        return
    context.state.ek.lastSuccessfulFindNmrows = None
    removed = set(prior) - set(current)
    for name in context.state.ek.loads:
        if context.state.ek.handles.get(name) in removed:
            context.state.ek.expiredLoads.add(name)


def run_kernels_step(step: WorkflowStep, context: SidecarRuntimeContext) -> StepOutput | None:
    if isinstance(step, StepKernelsFurnsh):
        resolved_file = resolve_path_ref(context.paths, step.file)
        prior = _ek_files(context)
        sp.furnsh(resolved_file)
        _changed_ek_files(context, prior)
        context.state.kernels.loadedVirtualKernelPaths.append(_to_virtual_kernel_path(step.file))
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelsKclear):
        prior = _ek_files(context)
        sp.kclear()
        _changed_ek_files(context, prior)
        return StepOutput(op=step.op, value=None)

    if isinstance(step, StepKernelsKinfo):
        try:
            filename = step.path if not step.path.strip() else resolve_path_ref(context.paths, step.path)
            out = _normalize_kinfo(sp.kinfo(filename), context, filename)
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelsKplfrm):
        out = _normalize_kplfrm(sp.kplfrm(step.frmcls, SPICEINT_CELL(step.capacity)))
        return StepOutput(op=step.op, value=out)

    if isinstance(step, StepKernelsKtotal):
        query = _native_query(step.kind)
        total = int(sp.ktotal(query)) if query is not None else len(_kind_entries(step.kind))
        return StepOutput(op=step.op, value=total)

    if isinstance(step, StepKernelsKdata):
        try:
            query = _native_query(step.kind)
            if query is not None:
                value = sp.kdata(step.which, query)
            else:
                entries = _kind_entries(step.kind)
                if step.which < 0 or step.which >= len(entries):
                    return StepOutput(op=step.op, value={"found": False})
                value = entries[step.which]
            out = _normalize_kdata(value, context)
            return StepOutput(op=step.op, value=out)
        except NotFoundError:
            return StepOutput(op=step.op, value={"found": False})

    if isinstance(step, StepKernelsKxtrct):
        # Match the supported adapter's ASCII argument normalization, but obtain
        # both outputs from the actual CSPICE operation. SpiceyPy's convenience
        # wrapper irreversibly rstrips tabs/Unicode whitespace from C outputs;
        # its default oversized NUL buffer also changes Fortran word parsing.
        def cstring(value: str) -> str:
            return value.split("\0", 1)[0]

        key = cstring(step.keywd).strip(" \t\n\r\f\v")
        if not key:
            raise ValueError("kxtrct keywd must be a non-empty string")
        terms = [cstring(t).strip(" \t\n\r\f\v") for t in step.terms]
        terms = [t for t in terms if t]
        words = cstring(step.string).encode("utf-8")
        if len(words) >= 1 << 20:
            raise ValueError("kxtrct(): wordsq is too large")
        width = max(2, max((len(t.encode("utf-8")) + 1 for t in terms), default=2))
        rows = ((ctypes.c_char * width) * max(1, len(terms)))()
        for index, term in enumerate(terms):
            rows[index].value = term.encode("utf-8")
        capacity = max(2, len(words) + 1)
        words_out = ctypes.create_string_buffer(words, capacity)
        substr = ctypes.create_string_buffer(capacity)
        found = ctypes.c_int(0)
        sp.libspice.kxtrct_c(
            key.encode("utf-8"), ctypes.c_int(width), rows,
            ctypes.c_int(len(terms)), ctypes.c_int(capacity), ctypes.c_int(capacity),
            words_out, ctypes.byref(found), substr,
        )
        sp.check_for_spice_error(None)
        if not found.value:
            return StepOutput(op=step.op, value={"found": False})
        return StepOutput(op=step.op, value={
            "found": True,
            "wordsq": words_out.value.decode("utf-8"),
            "substr": substr.value.decode("utf-8"),
        })

    if isinstance(step, StepKernelsUnload):
        prior = _ek_files(context)
        sp.unload(step.path if not step.path.strip() else resolve_path_ref(context.paths, step.path))
        _changed_ek_files(context, prior)
        return StepOutput(op=step.op, value=None)

    return None
