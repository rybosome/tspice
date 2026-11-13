from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import spiceypy as sp
from py_parity_sidecar.models import RuntimePaths, PathRef, StepEphemerisSpkopn, StepEphemerisSpkw08
from py_parity_sidecar.handlers.ephemeris import run_ephemeris_step
from py_parity_sidecar.runtime.context import create_runtime_context
from py_parity_sidecar.runtime.lifecycle import before_case_lifecycle, finalize_case_lifecycle
class SpkCleanupTests(unittest.TestCase):
    def test_actual_pending_writer_retries_before_scratch_removal(self):
        fixtures=Path(__file__).resolve().parents[3]/'fixtures'
        with tempfile.TemporaryDirectory() as parent:
            scratch=Path(parent)/'scratch';context=create_runtime_context(RuntimePaths(fixturesRoot=str(fixtures),scratchRoot=str(scratch)))
            before_case_lifecycle()
            run_ephemeris_step(StepEphemerisSpkopn(op='ephemeris.spkopn',file=PathRef(kind='scratch',rel='pending.bsp'),ifname='AUTHORED',ncomch=0,handleId='H'),context)
            run_ephemeris_step(StepEphemerisSpkw08(op='ephemeris.spkw08',handleId='H',body=100001,center=0,frame='J2000',first=0,last=60,segid='AUTHORED',degree=1,states=[1,2,3,4,5,6,241,302,363,4,5,6],epoch1=0,step=60),context)
            original=sp.spkcls;attempts=[]
            def close(handle):
                attempts.append((scratch.exists(),bool(sp.failed())))
                if len(attempts)==1:raise RuntimeError('controlled first close failure')
                original(handle)
            sp.libspice.sigerr_c(b'SPICE(AUDITPENDING)')
            self.assertTrue(sp.libspice.failed_c())
            try:
                with patch('py_parity_sidecar.handlers.ephemeris.sp.spkcls',close):finalize_case_lifecycle(context)
                self.assertEqual(attempts,[(True,False),(True,False)])
                self.assertEqual(context.state.ephemeris.spkHandles,{})
                self.assertFalse(scratch.exists())
            finally:sp.reset();sp.kclear()
if __name__=='__main__':unittest.main()
