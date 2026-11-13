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

it("the DLA oracle preserves actual CSPICE errors instead of converting failed found flags into misses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dla-oracle-"));
  try {
    const out = execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        path.join(packageRoot, "sidecars/spiceypy"),
        "python",
        "-c",
        `
import sys, spiceypy as sp
from spiceypy.utils.support_types import SpiceDLADescr
from py_parity_sidecar.models import RuntimePaths, StepFileIoDlabfs, StepFileIoDlafns
from py_parity_sidecar.runtime import create_runtime_context, FileIoHandleState
from py_parity_sidecar.handlers.file_io import run_file_io_step
ctx = create_runtime_context(RuntimePaths(fixturesRoot=sys.argv[1], scratchRoot=sys.argv[1]))
ctx.state.fileIo.handles['bad'] = FileIoHandleState(handle=2147483647, kind='DAS', closeWith='dascls', isOpen=True)
ctx.state.fileIo.descriptors['d'] = SpiceDLADescr()
sp.kclear()
try:
    for step in [StepFileIoDlabfs(op='file-io.dlabfs', handleId='bad', descrId='d'), StepFileIoDlafns(op='file-io.dlafns', handleId='bad', descrId='d')]:
        try:
            run_file_io_step(step, ctx)
        except Exception as exc:
            assert 'SPICE(' in str(exc), repr(exc)
            assert not sp.failed()
            print(step.op, 'preserved actual error')
        else:
            raise AssertionError(step.op + ' masked actual SPICE error as found=false')
        finally:
            sp.reset()
finally:
    sp.kclear()
`,
        root,
      ],
      { encoding: "utf8" },
    );
    expect(out).toContain("file-io.dlabfs preserved actual error");
    expect(out).toContain("file-io.dlafns preserved actual error");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 20000);

it("closes outstanding oracle file handles before deleting scratch on workflow failure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-reader-cleanup-"));
  try {
    const out = execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        path.join(packageRoot, "sidecars/spiceypy"),
        "python",
        "-c",
        `
import sys, pathlib, spiceypy as sp
from py_parity_sidecar.models import RuntimePaths
from py_parity_sidecar.runtime import create_runtime_context, FileIoHandleState, finalize_case_lifecycle
root = pathlib.Path(sys.argv[1])
ctx = create_runtime_context(RuntimePaths(fixturesRoot=sys.argv[2], scratchRoot=str(root)))
reader = sp.dafopr(str(pathlib.Path(sys.argv[2]) / 'kernels/audit-two-segment.bsp'))
writer = sp.dlaopn(str(root / 'pending.dla'), 'DLA', 'AUTHORED CLEANUP', 0)
ctx.state.fileIo.handles['r'] = FileIoHandleState(handle=reader, kind='DAF', closeWith='dafcls', isOpen=True)
ctx.state.fileIo.handles['w'] = FileIoHandleState(handle=writer, kind='DLA', closeWith='dascls', isOpen=True)
closed = []
def wrap(name, original):
    def close(handle):
        assert root.exists(), 'scratch removed before native file close'
        original(handle)
        closed.append(name)
    return close
sp.dafcls = wrap('dafcls', sp.dafcls)
sp.dascls = wrap('dascls', sp.dascls)
try:
    raise ValueError('representative workflow failure')
except ValueError:
    finalize_case_lifecycle(ctx)
assert sorted(closed) == ['dafcls', 'dascls'], closed
assert not root.exists()
print('closed both native files before scratch cleanup')
`,
        root,
        path.join(packageRoot, "fixtures"),
      ],
      { encoding: "utf8" },
    );
    expect(out).toContain("closed both native files before scratch cleanup");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 20000);
