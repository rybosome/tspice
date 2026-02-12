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
      `import * as tspiceWeb from "@rybosome/tspice/web";`,
      ``,
      `if (typeof tspice.createBackend !== "function") throw new Error("Missing createBackend export");`,
      `if (typeof tspice.createSpice !== "function") throw new Error("Missing createSpice export");`,
      `if (typeof tspice.withCaching !== "function") throw new Error("Missing withCaching export");`,
      `if (typeof tspice.createSpiceWorkerClient !== "function") throw new Error("Missing createSpiceWorkerClient export");`,
      ``,
      `if (typeof tspiceWeb.withCaching !== "function") throw new Error("Missing tspice/web withCaching export");`,
      `if (typeof tspiceWeb.createSpiceClients !== "function") throw new Error("Missing tspice/web createSpiceClients export");`,
      `if (typeof tspiceWeb.createSpiceWorkerClient !== "function") throw new Error("Missing tspice/web createSpiceWorkerClient export");`,
      ``,
      `// Ensure we do NOT expose unexpected subpath exports from the published package.
      // (allowlist is defined by package.exports: "." and "./web")
      `,
      `for (const subpath of ["worker", "core", "backend-contract", "backend-wasm", "backend-node", "web/worker", "web/client", "web/kernels"]) {`,
      `  try {`,
      '    await import(`@rybosome/tspice/${subpath}`);',
      '    throw new Error(`Expected @rybosome/tspice/${subpath} to be blocked by package.exports`);',
      `  } catch (err) {`,
      `    // Node typically throws ERR_PACKAGE_PATH_NOT_EXPORTED; don't overfit
      // the exact error string.
      `,
      `    if (!(err && typeof err === "object" && "code" in err)) {`,
      `      throw err;`,
      `    }`,
      `  }`,
      `}`,
      ``,
      `console.log("dist-publish consumer smoke test: ok");`,
    ].join("\n"),
    "utf8",
  );

  run("node", ["./smoke-imports.mjs"], { cwd: tmpDir, stdio: "inherit" });

  // Validate internal-only package.json `imports` aliases ("#...") are wired up
  // correctly for vendored workspace modules.
  const installedPkgRoot = path.join(tmpDir, "node_modules", "@rybosome", "tspice");
  const internalSmokePath = path.join(installedPkgRoot, "internal-imports-smoke.mjs");
  fs.writeFileSync(
    internalSmokePath,
    [
      `import * as core from "#core";`,
      `import * as contract from "#backend-contract";`,
      `import * as fake from "#backend-fake";`,
      `import * as wasm from "#backend-wasm";`,
      `import * as nodeBackend from "#backend-node";`,
      ``,
      `if (typeof core.assertNever !== "function") throw new Error("Missing core.assertNever");`,
      `if (typeof contract !== "object") throw new Error("Missing backend-contract module");`,
      `if (typeof fake.createFakeBackend !== "function") throw new Error("Missing backend-fake.createFakeBackend");`,
      `if (typeof wasm.createWasmBackend !== "function") throw new Error("Missing backend-wasm.createWasmBackend");`,
      `if (typeof nodeBackend.createNodeBackend !== "function") throw new Error("Missing backend-node.createNodeBackend");`,
      ``,
      `console.log("dist-publish internal imports smoke test: ok");`,
    ].join("\n"),
    "utf8",
  );

  run("node", ["./internal-imports-smoke.mjs"], { cwd: installedPkgRoot, stdio: "inherit" });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(tarballPath, { force: true });
}
