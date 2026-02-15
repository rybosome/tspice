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

const distPublishPkg = JSON.parse(
  fs.readFileSync(path.join(distPublishRoot, "package.json"), "utf8"),
);

function normalizeExportKey(key) {
  if (key === ".") return "";
  if (key.startsWith("./")) return key.slice(2);
  return key;
}

function listDirectorySubpaths(rootDir) {
  const out = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const abs = path.join(dir, entry.name);
      const rel = path
        .relative(rootDir, abs)
        .split(path.sep)
        .join("/");

      out.push(rel);
      walk(abs);
    }
  };

  walk(rootDir);
  return out;
}

function deriveAllowedSubpaths(exportsField) {
  // Node treats `"exports": "./dist/index.js"` and conditional objects (without
  // `"."` / `"./..."` keys) as applying to the package root.
  if (exportsField == null) return [""];
  if (typeof exportsField === "string") return [""];
  if (Array.isArray(exportsField)) return [""];

  if (typeof exportsField === "object") {
    const keys = Object.keys(exportsField);
    const hasSubpathKeys = keys.some((k) => k === "." || k.startsWith("./"));
    if (!hasSubpathKeys) return [""];

    // Ignore non-subpath keys (e.g. "import" / "default").
    return keys.filter((k) => k === "." || k.startsWith("./")).map(normalizeExportKey);
  }

  return [""];
}

const allowedSubpaths = Array.from(
  new Set(deriveAllowedSubpaths(distPublishPkg.exports)),
).sort();
const candidateSubpaths = Array.from(
  new Set([
    ...allowedSubpaths,
    ...listDirectorySubpaths(distPublishRoot),
    "definitely-not-real",
  ]),
).sort();

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
      ``,
      `if (typeof tspice.spiceClients !== "object") throw new Error("Missing spiceClients export");`,
      ``,
      `if (typeof tspice.createBackend !== "function") throw new Error("Missing createBackend export");`,
      `if (typeof tspice.createSpice !== "function") throw new Error("Missing createSpice export");`,
      `if (typeof tspice.createSpiceAsync !== "function") throw new Error("Missing createSpiceAsync export");`,
      `if ("withCaching" in tspice) throw new Error("Unexpected withCaching export");`,
      `if ("withCachingSync" in tspice) throw new Error("Unexpected withCachingSync export");`,
      `if ("createSpiceWorkerClient" in tspice) throw new Error("Unexpected createSpiceWorkerClient export");`,
      `if ("createWorkerTransport" in tspice) throw new Error("Unexpected createWorkerTransport export");`,
      ``,
      `// Ensure we do NOT expose unexpected subpath exports from the published package.
      // Allowlist is derived from package.json#exports.
      `,
      `const allowedSubpaths = ${JSON.stringify(allowedSubpaths)};`,
      `const candidateSubpaths = ${JSON.stringify(candidateSubpaths)};`,
      `const allowed = new Set(allowedSubpaths);`,
      ``,
      `for (const subpath of candidateSubpaths) {`,
      `  const specifier = subpath === "" ? "@rybosome/tspice" : ` +
        '`@rybosome/tspice/${subpath}`;',
      `  const shouldImport = allowed.has(subpath);`,
      ``,
      `  try {`,
      `    await import(specifier);`,
      `    if (!shouldImport) {`,
      `      throw new Error(` +
        '`Unexpected export: ${specifier} is importable but is not listed in package.json#exports`' +
        `);`,
      `    }`,
      `  } catch (err) {`,
      `    if (shouldImport) {`,
      `      throw new Error(` +
        '`Expected ${specifier} to be importable (listed in package.json#exports), but import failed: ${String(err)}`' +
        `);`,
      `    }`,
      ``,
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
