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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dsk-oracle-"));
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
it("DSK traversal preserves actual errors and accepts a genuine empty miss", () => {
  const out = python(`
import sys, spiceypy as sp
from py_parity_sidecar.models import RuntimePaths, StepDskDlabfs
from py_parity_sidecar.runtime import create_runtime_context, finalize_case_lifecycle
from py_parity_sidecar.handlers.dsk import run_dsk_step
ctx=create_runtime_context(RuntimePaths(fixturesRoot=sys.argv[1],scratchRoot=sys.argv[1]))
ctx.state.dsk.handles['bad']={'handle':2147483647,'isOpen':True}
try:
    try:
        run_dsk_step(StepDskDlabfs(op='dsk.dlabfs',handleId='bad',dladscId='d'),ctx)
    except Exception as exc:
        assert 'SPICE(' in str(exc), repr(exc)
        assert not sp.failed()
    else:
        raise AssertionError('masked actual SPICE failure')
    h=sp.dskopn(sys.argv[1]+'/empty.bds','AUTHORED_EMPTY',0)
    ctx.state.dsk.handles['empty']={'handle':h,'isOpen':True}
    result=run_dsk_step(StepDskDlabfs(op='dsk.dlabfs',handleId='empty',dladscId='d'),ctx)
    assert result.value == {'found':False}, result
    print('actual error and empty miss distinguished')
finally:
    sp.reset()
    ctx.state.dsk.handles.pop('bad',None)
    finalize_case_lifecycle(ctx)
`);
  expect(out).toContain("actual error and empty miss distinguished");
}, 20000);
it("closes an actual pending DSK writer before deleting its scratch file", () => {
  const out = python(`
import sys, pathlib, spiceypy as sp
from py_parity_sidecar.models import RuntimePaths, StepDskDskopn, PathRef
from py_parity_sidecar.runtime import create_runtime_context, finalize_case_lifecycle
from py_parity_sidecar.handlers.dsk import run_dsk_step
root=pathlib.Path(sys.argv[1])
ctx=create_runtime_context(RuntimePaths(fixturesRoot=str(root),scratchRoot=str(root)))
run_dsk_step(StepDskDskopn(op='dsk.dskopn',handleId='w',path=PathRef(kind='scratch',rel='pending.bds'),ifname='AUTHORED_PENDING',ncomch=0),ctx)
h=ctx.state.dsk.handles['w']['handle']
original=sp.dascls
closed=[]
def close(handle):
    assert root.exists(), 'scratch deleted before actual close'
    original(handle)
    closed.append(handle)
sp.dascls=close
try:
    finalize_case_lifecycle(ctx)
    assert closed == [h], closed
    assert not ctx.state.dsk.handles['w']['isOpen']
    assert not root.exists()
    print('actual writer closed before scratch cleanup')
finally:
    sp.dascls=original
    sp.reset()
    if not closed:original(h)
`);
  expect(out).toContain("actual writer closed before scratch cleanup");
}, 20000);
