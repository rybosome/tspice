import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return result.stdout.trim();
}
describe("shared cell registry allocation failure", () => {
  it.runIf(nodeAddonAvailable())(
    "rolls back every cell constructor when registry allocation fails",
    () => {
      const scratch = mkdtempSync(
        path.join(os.tmpdir(), "tspice-cell-rollback-"),
      );
      try {
        const cspice = run(process.execPath, ["scripts/print-cspice-dir.mjs"]);
        const shim = path.join(root, "packages/backend-shim-c");
        const compiler = "cc";
        const flags = [
          "-std=c11",
          `-I${path.join(shim, "include")}`,
          `-I${path.join(cspice, "include")}`,
        ];
        const objects: string[] = [];
        for (const [name, source, defines] of [
          [
            "cells",
            path.join(shim, "src/domains/cells_windows.c"),
            ["-Dmalloc=rollback_test_malloc", "-Dfree=rollback_test_free"],
          ],
          [
            "registry",
            path.join(shim, "src/handle_validation.c"),
            ["-Drealloc=rollback_test_realloc"],
          ],
          ["errors", path.join(shim, "src/errors.c"), []],
        ] as const) {
          const output = path.join(scratch, `${name}.o`);
          run(compiler, [...flags, ...defines, "-c", source, "-o", output]);
          objects.push(output);
        }
        const binary = path.join(scratch, "rollback");
        run(compiler, [
          ...flags,
          "packages/backend-node/test/fixtures/cell-registry-rollback.c",
          ...objects,
          path.join(cspice, "lib/cspice.a"),
          path.join(cspice, "lib/csupport.a"),
          "-lm",
          "-o",
          binary,
        ]);
        run(binary, []);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  );
});
