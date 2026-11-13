import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return result.stdout.trim();
}
it.runIf(process.env.TSPICE_EXPECT_NATIVE === "true")(
  "the actual EK C shim validates storage against the actual segment schema",
  () => {
    const scratch = mkdtempSync(path.join(os.tmpdir(), "tspice-ek-bounds-"));
    try {
      const cspice = run(process.execPath, ["scripts/print-cspice-dir.mjs"]);
      const shim = path.join(root, "packages/backend-shim-c");
      const flags = [
        "-std=c11",
        `-I${path.join(shim, "include")}`,
        `-I${path.join(cspice, "include")}`,
      ];
      const io = path.join(scratch, "io.o");
      const errors = path.join(scratch, "errors.o");
      run("cc", [
        ...flags,
        "-c",
        "packages/backend-node/test/fixtures/ek-column-shim.c",
        "-o",
        io,
      ]);
      run("cc", [
        ...flags,
        "-c",
        path.join(shim, "src/errors.c"),
        "-o",
        errors,
      ]);
      const binary = path.join(scratch, "bounds");
      run("cc", [
        ...flags,
        "packages/backend-node/test/fixtures/ek-column-bounds.c",
        io,
        errors,
        path.join(cspice, "lib/cspice.a"),
        path.join(cspice, "lib/csupport.a"),
        "-lm",
        "-o",
        binary,
      ]);
      expect(run(binary, [path.join(scratch, "bounds.ek")])).toContain(
        "validated actual segment row counts and fixed column backing",
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
