import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

// Turbo's build dependencies already prepared the artifacts before this task
// started. Running another build here can restore/truncate files being imported
// by sibling tests. TURBO_HASH is supplied by Turbo, including strict env mode.
if (!process.env.TURBO_HASH) {
  const { name } = JSON.parse(readFileSync("package.json", "utf8"));
  if (typeof name !== "string" || !name) {
    throw new Error("Package preparation requires a named package");
  }
  const dependenciesOnly = process.argv.slice(2).includes("--dependencies");
  const result = spawnSync(
    "pnpm",
    [
      "-w",
      "exec",
      "turbo",
      "run",
      "build",
      `--filter=${name}${dependenciesOnly ? "^..." : ""}`,
    ],
    { cwd: path.resolve(process.cwd()), stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
