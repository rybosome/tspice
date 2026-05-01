from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

PathRefKind: TypeAlias = Literal["fixture", "scratch"]


@dataclass(frozen=True)
class PathRef:
    kind: PathRefKind
    rel: str


PathRefInput: TypeAlias = PathRef | str


@dataclass(frozen=True)
class RuntimePaths:
    fixturesRoot: str
    scratchRoot: str


@dataclass(frozen=True)
class RuntimeConfig:
    paths: RuntimePaths
