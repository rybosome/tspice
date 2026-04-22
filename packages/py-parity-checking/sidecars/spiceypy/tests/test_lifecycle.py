from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from py_parity_sidecar.models import RuntimePaths
from py_parity_sidecar.runtime import (
    SidecarRuntimeContext,
    before_case_lifecycle,
    finalize_case_lifecycle,
)


class LifecycleTests(unittest.TestCase):
    def test_finalizers_run_best_effort_then_kclear_reset(self) -> None:
        with tempfile.TemporaryDirectory() as fixtures_root, tempfile.TemporaryDirectory() as scratch_parent:
            scratch_root = str(Path(scratch_parent) / "scratch")
            paths = RuntimePaths(fixturesRoot=fixtures_root, scratchRoot=scratch_root)
            context = SidecarRuntimeContext(paths=paths)

            calls: list[str] = []
            context.register_finalizer("alpha", lambda: calls.append("alpha"))

            def _boom() -> None:
                calls.append("beta")
                raise RuntimeError("ignore")

            context.register_finalizer("beta", _boom)
            context.register_finalizer("gamma", lambda: calls.append("gamma"))

            with patch("py_parity_sidecar.runtime.lifecycle.sp.kclear") as kclear, patch(
                "py_parity_sidecar.runtime.lifecycle.sp.reset"
            ) as reset:
                before_case_lifecycle()
                finalize_case_lifecycle(context)

            self.assertEqual(calls, ["alpha", "beta", "gamma"])
            self.assertEqual(kclear.call_count, 2)
            self.assertEqual(reset.call_count, 2)


if __name__ == "__main__":
    unittest.main()
