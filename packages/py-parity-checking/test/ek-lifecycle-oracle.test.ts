import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
function python(source: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-ek-oracle-"));
  try {
    return execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        path.join(packageRoot, "sidecars/spiceypy"),
        "python",
        "-c",
        source,
        root,
      ],
      { encoding: "utf8" },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
it("closes an actual pending EK before scratch deletion and clears captured toolkit failure", () => {
  const out = python(`
import sys,pathlib,spiceypy as sp
from spiceypy.utils import support_types as stypes
from spiceypy.utils.libspicehelper import libspice
from py_parity_sidecar.models import RuntimePaths,StepEkEkopn
from py_parity_sidecar.runtime import create_runtime_context,finalize_case_lifecycle
from py_parity_sidecar.handlers.ek import run_ek_step
root=pathlib.Path(sys.argv[1]);ctx=create_runtime_context(RuntimePaths(fixturesRoot=str(root),scratchRoot=str(root)))
run_ek_step(StepEkEkopn(op='ek.ekopn',path='pending.ek',ifname='AUTHORED_EK',ncomch=0,handleId='w'),ctx)
h=ctx.state.ek.handles['w'];original=sp.ekcls;closed=[]
def close(handle):
    assert root.exists(), 'scratch deleted before actual EK close'
    assert not sp.failed(), 'captured error prevented actual EK close'
    original(handle);closed.append(handle)
sp.ekcls=close
libspice.setmsg_c(stypes.string_to_char_p('Authored captured failure'))
libspice.sigerr_c(stypes.string_to_char_p('SPICE(AUDITCAPTURED)'))
assert sp.failed()
try:
    finalize_case_lifecycle(ctx)
    assert closed == [h], closed
    assert not ctx.state.ek.handles
    assert not root.exists()
    print('actual EK closed before scratch cleanup')
finally:
    sp.ekcls=original;sp.reset()
    if not closed:original(h)
`);
  expect(out).toContain("actual EK closed before scratch cleanup");
}, 20000);
it("retains oracle bookkeeping after a failed close so a real native close can retry", () => {
  const out = python(`
import sys,pathlib,spiceypy as sp
from py_parity_sidecar.models import RuntimePaths,StepEkEkopn
from py_parity_sidecar.runtime import create_runtime_context,finalize_case_lifecycle
from py_parity_sidecar.handlers.ek import run_ek_step,_close_handle_best_effort
root=pathlib.Path(sys.argv[1]);ctx=create_runtime_context(RuntimePaths(fixturesRoot=str(root),scratchRoot=str(root)))
run_ek_step(StepEkEkopn(op='ek.ekopn',path='retry.ek',ifname='AUTHORED_RETRY',ncomch=0,handleId='w'),ctx)
h=ctx.state.ek.handles['w'];original=sp.ekcls;attempts=[]
def fail_once(handle):
    attempts.append(handle)
    if len(attempts)==1:raise OSError('authored close failure before native call')
    original(handle)
sp.ekcls=fail_once
try:
    _close_handle_best_effort(ctx,'w')
    assert ctx.state.ek.handles.get('w') == h, 'lost pending close claim'
    _close_handle_best_effort(ctx,'w')
    assert attempts == [h,h] and not ctx.state.ek.handles
    print('failed close retained and actual close retried')
finally:
    sp.ekcls=original;sp.reset()
    if len(attempts)<2:original(h)
    ctx.state.ek.handles.clear();finalize_case_lifecycle(ctx)
`);
  expect(out).toContain("failed close retained and actual close retried");
}, 20000);
