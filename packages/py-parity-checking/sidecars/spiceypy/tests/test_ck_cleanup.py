from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import spiceypy as sp
from py_parity_sidecar.models import PathRef, RuntimePaths, StepFramesCklpf
from py_parity_sidecar.handlers.frames import run_frames_step
from py_parity_sidecar.runtime.context import create_runtime_context
from py_parity_sidecar.runtime.lifecycle import before_case_lifecycle, finalize_case_lifecycle

class CkCleanupTests(unittest.TestCase):
    def test_actual_pending_handle_retries_before_scratch_removal(self):
        fixtures = Path(__file__).resolve().parents[3] / 'fixtures'
        with tempfile.TemporaryDirectory() as parent:
            scratch = Path(parent) / 'scratch'
            context = create_runtime_context(RuntimePaths(fixturesRoot=str(fixtures), scratchRoot=str(scratch)))
            target = scratch / 'pending.bc'
            shutil.copyfile(fixtures / 'kernels/audit-pointing.bc', target)
            before_case_lifecycle()
            run_frames_step(StepFramesCklpf(op='frames.cklpf', ck=PathRef(kind='scratch',rel='pending.bc'), handleId='PENDING'), context)
            original = sp.ckupf
            attempts = []
            def close(handle):
                attempts.append((target.exists(), bool(sp.failed())))
                if len(attempts) == 1:
                    raise RuntimeError('controlled first close failure')
                original(handle)
            # Actual pending toolkit error must be cleared before real close.
            sp.libspice.sigerr_c(b'SPICE(AUDITPENDING)')
            self.assertTrue(sp.libspice.failed_c())
            try:
                with patch('py_parity_sidecar.handlers.frames.sp.ckupf', close):
                    finalize_case_lifecycle(context)
                self.assertEqual(attempts, [(True,False),(True,False)])
                self.assertEqual(context.state.frames.ckHandles,{})
                self.assertFalse(scratch.exists())
            finally:
                sp.reset();sp.kclear()

if __name__=='__main__': unittest.main()
