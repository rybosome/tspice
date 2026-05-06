from __future__ import annotations

import os
import posixpath
import shutil
import tempfile
from pathlib import Path

from ..models import PathRef, PathRefInput, RuntimePaths


def normalize_path_ref_relative_path(rel: str) -> str:
    normalized = rel.replace("\\", "/")
    if normalized == "":
        raise ValueError("PathRef.rel must be non-empty")
    if normalized.startswith("/") or normalized == ".." or normalized.startswith("../"):
        raise ValueError(f"PathRef.rel must be relative: {rel}")

    collapsed = posixpath.normpath(normalized)
    if (
        collapsed == ""
        or collapsed == "."
        or collapsed.startswith("/")
        or collapsed == ".."
        or collapsed.startswith("../")
        or "/../" in collapsed
    ):
        raise ValueError(f"PathRef.rel escapes root: {rel}")

    return collapsed


def to_path_ref(path_ref_input: PathRefInput) -> PathRef:
    if isinstance(path_ref_input, PathRef):
        kind = path_ref_input.kind
        if kind not in {"fixture", "scratch"}:
            raise ValueError(f"Unsupported PathRef.kind: {kind}")
        return PathRef(kind=kind, rel=normalize_path_ref_relative_path(path_ref_input.rel))

    if isinstance(path_ref_input, str):
        # Current default: plain strings are fixture-relative unless explicitly marked scratch.
        return PathRef(kind="fixture", rel=normalize_path_ref_relative_path(path_ref_input))

    raise TypeError(f"Unsupported path-ref input: {path_ref_input!r}")


def _resolve_path_under_root(root: str, rel: str) -> str:
    root_path = Path(root).resolve()
    resolved = (root_path / rel).resolve()
    try:
        resolved.relative_to(root_path)
    except ValueError as exc:
        raise ValueError(f"Resolved path escapes root: {rel}") from exc
    return str(resolved)


def resolve_path_ref(paths: RuntimePaths, path_ref_input: PathRefInput) -> str:
    if isinstance(path_ref_input, str) and os.path.isabs(path_ref_input):
        # Legacy compatibility for pre-PathRef callers.
        return str(Path(path_ref_input).resolve())

    path_ref = to_path_ref(path_ref_input)
    root = paths.fixturesRoot if path_ref.kind == "fixture" else paths.scratchRoot
    return _resolve_path_under_root(root, path_ref.rel)


def create_default_runtime_paths(case_id: str) -> RuntimePaths:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in case_id).strip("-")
    cleaned = cleaned[:48] if cleaned else "case"
    scratch_root = tempfile.mkdtemp(prefix=f"py-parity-{cleaned}-")
    return RuntimePaths(fixturesRoot=str(Path.cwd()), scratchRoot=str(Path(scratch_root).resolve()))


def ensure_scratch_root(paths: RuntimePaths) -> None:
    Path(paths.scratchRoot).mkdir(parents=True, exist_ok=True)


def remove_scratch_root_best_effort(paths: RuntimePaths) -> None:
    shutil.rmtree(paths.scratchRoot, ignore_errors=True)
