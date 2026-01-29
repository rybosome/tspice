import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertNoInternalWorkspaceSpecifiers } from "./assert-no-internal-specifiers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const distPublishRoot = path.join(repoRoot, "packages", "tspice", "dist-publish");

if (!fs.existsSync(path.join(distPublishRoot, "package.json"))) {
  throw new Error(
    `Missing dist-publish/package.json at ${distPublishRoot}. Run pnpm -C packages/tspice build:dist-publish first.`,
  );
}

// 0) Hard assertion: published tarball must not contain internal workspace
//    specifiers that will not exist on npm.
assertNoInternalWorkspaceSpecifiers({ rootDir: distPublishRoot });

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed (exit=${result.status ?? "unknown"})\n${result.stderr ?? ""}`,
    );
  }
  return result;
}

// 1) Ensure it can be packed for real (not a dry run), since we rely on npm's
//    packing logic in release.
const packResult = run("npm", ["pack", "--silent"], {
  cwd: distPublishRoot,
  stdio: ["ignore", "pipe", "inherit"],
});

const tarballName = packResult.stdout.trim().split("\n").filter(Boolean).at(-1);
if (!tarballName) {
  throw new Error("npm pack did not produce a tarball name on stdout");
}

const tarballPath = path.join(distPublishRoot, tarballName);
if (!fs.existsSync(tarballPath)) {
  throw new Error(`npm pack reported ${tarballName}, but it was not created at ${tarballPath}`);
}

// 2) Simulate a real consumer install and ensure ESM imports work.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tspice-dist-publish-"));

try {
  run("npm", ["init", "-y"], { cwd: tmpDir, stdio: "ignore" });

  // Avoid hitting the network for optional platform-native deps during CI.
  run("npm", ["install", "--omit=optional", "--no-audit", "--no-fund", tarballPath], {
    cwd: tmpDir,
    stdio: "inherit",
  });

  const smokePath = path.join(tmpDir, "smoke-imports.mjs");
  fs.writeFileSync(
    smokePath,
    [
      `import * as tspice from "@rybosome/tspice";`,
      `import * as core from "@rybosome/tspice/core";`,
      `import * as contract from "@rybosome/tspice/backend-contract";`,
      `import * as fake from "@rybosome/tspice/backend-fake";`,
      `import * as wasm from "@rybosome/tspice/backend-wasm";`,
      `import * as nodeBackend from "@rybosome/tspice/backend-node";`,
      ``,
      `if (typeof tspice.createBackend !== "function") throw new Error("Missing createBackend export");`,
      `if (typeof tspice.createSpice !== "function") throw new Error("Missing createSpice export");`,
      `if (typeof contract !== "object") throw new Error("Missing backend-contract exports");`,
      `if (typeof core !== "object") throw new Error("Missing core exports");`,
      `if (typeof wasm !== "object") throw new Error("Missing backend-wasm exports");`,
      `if (typeof fake !== "object") throw new Error("Missing backend-fake exports");`,
      `if (typeof nodeBackend !== "object") throw new Error("Missing backend-node exports");`,
      ``,
      `console.log("dist-publish consumer smoke test: ok");`,
    ].join("\n"),
    "utf8",
  );

  run("node", ["./smoke-imports.mjs"], { cwd: tmpDir, stdio: "inherit" });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(tarballPath, { force: true });
}
