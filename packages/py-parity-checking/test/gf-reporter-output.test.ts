import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const probe = fileURLToPath(
  new URL("./fixtures/gf-reporter-probe.mjs", import.meta.url),
);
const sidecar = fileURLToPath(new URL("../sidecars/spiceypy", import.meta.url));
const python = `import sys
import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
mode=sys.argv[1]
w=SPICEDOUBLE_CELL(8)
sp.wninsd(-10,10,w)
sp.wninsd(20,40,w)
if mode!='without-init':sp.gfrepi(w,'audit begin','audit end')
if mode!='init':sp.gfrepf()
if mode=='repeat':
 sp.gfrepi(w,'second begin','second end')
 sp.gfrepf()
sp.kclear()
sp.reset()
`;
function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status, result.stderr).toBe(0);
  // Emscripten's default print callback adds line endings when flushing its
  // console buffer. Preserve message spaces, percentages and erase characters.
  return result.stdout.replace(/[\r\n]/g, "");
}
for (const backend of ["node", "wasm"] as const)
  for (const mode of ["init", "finalize", "repeat", "without-init"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(
      `${backend}: actual GF reporter stdout ${mode} matches live SpiceyPy`,
      () => {
        const expected = output("uv", [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          "-c",
          python,
          mode,
        ]);
        const actual = output(process.execPath, [probe, backend, mode]);
        expect(actual).toBe(expected);
        if (mode === "without-init") expect(actual).toBe("");
        else expect(actual).toContain("audit begin   0.00% audit end");
        if (mode === "finalize" || mode === "repeat") {
          expect(actual).toContain("\b");
          // A real probe omitting finalization must fail this same output comparison.
          expect(output(process.execPath, [probe, backend, "init"])).not.toBe(
            expected,
          );
        }
        if (mode === "repeat")
          expect(actual).toContain("second begin   0.00% second end");
      },
    );
