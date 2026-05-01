from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from py_parity_sidecar.models import PathRef, RuntimePaths
from py_parity_sidecar.runtime import normalize_path_ref_relative_path, resolve_path_ref


class PathRefTests(unittest.TestCase):
    def test_resolves_fixture_and_scratch_refs(self) -> None:
        with tempfile.TemporaryDirectory() as fixtures_root, tempfile.TemporaryDirectory() as scratch_root:
            paths = RuntimePaths(fixturesRoot=fixtures_root, scratchRoot=scratch_root)

            fixture = resolve_path_ref(paths, PathRef(kind="fixture", rel="kernels/naif0012.tls"))
            scratch = resolve_path_ref(paths, PathRef(kind="scratch", rel="tmp/generated.tls"))

            self.assertEqual(fixture, str((Path(fixtures_root) / "kernels" / "naif0012.tls").resolve()))
            self.assertEqual(scratch, str((Path(scratch_root) / "tmp" / "generated.tls").resolve()))

    def test_legacy_string_paths_map_to_fixture_refs(self) -> None:
        with tempfile.TemporaryDirectory() as fixtures_root, tempfile.TemporaryDirectory() as scratch_root:
            paths = RuntimePaths(fixturesRoot=fixtures_root, scratchRoot=scratch_root)
            resolved = resolve_path_ref(paths, "kernels/naif0012.tls")
            self.assertEqual(resolved, str((Path(fixtures_root) / "kernels" / "naif0012.tls").resolve()))

    def test_rejects_traversal(self) -> None:
        with self.assertRaises(ValueError):
            normalize_path_ref_relative_path("../escape.txt")


if __name__ == "__main__":
    unittest.main()
