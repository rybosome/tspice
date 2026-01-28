import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const distPublishRoot = path.join(repoRoot, "packages", "tspice", "dist-publish");

if (!fs.existsSync(path.join(distPublishRoot, "package.json"))) {
  throw new Error(
    `Missing dist-publish/package.json at ${distPublishRoot}. Run pnpm -C packages/tspice build:dist-publish first.`,
  );
}

const result = spawnSync("npm", ["pack", "--silent", "--dry-run"], {
  cwd: distPublishRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  throw new Error(`npm pack failed for dist-publish (exit=${result.status ?? "unknown"})`);
}
