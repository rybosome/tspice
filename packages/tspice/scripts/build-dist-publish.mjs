import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const tspiceRoot = path.join(repoRoot, "packages", "tspice");

const distPublishRoot = path.join(tspiceRoot, "dist-publish");

/**
 * NOTE: The published `@rybosome/tspice` package must not depend on other
 * `@rybosome/*` packages existing on npm.
 *
 * We achieve this by copying our internal workspace package builds into
 * `dist-publish/` and rewriting their import specifiers to use *internal*
 * package.json `imports` aliases ("#...").
 *
 * This keeps the public surface area limited to `@rybosome/tspice`,
 * while still letting vendored internal modules reference each other.
 */
const SPECIFIER_REWRITES = new Map([
  ["@rybosome/tspice-core", "#core"],
  ["@rybosome/tspice-backend-contract", "#backend-contract"],
  ["@rybosome/tspice-backend-wasm", "#backend-wasm"],
  ["@rybosome/tspice-backend-fake", "#backend-fake"],
  ["@rybosome/tspice-backend-node", "#backend-node"],
  // Handles the bundler-safe dynamic import pattern:
  //   "@rybosome/tspice-backend-" + "node"
  ["@rybosome/tspice-backend-", "#backend-"],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function shouldCopyFile(basename) {
  // Source maps reference original import specifiers and become misleading after
  // rewriting. Exclude them.
  if (basename.endsWith(".map")) return false;
  return true;
}

function rewriteSpecifiersInFile(destPath) {
  const ext = path.extname(destPath);
  const isCode = ext === ".js" || ext === ".d.ts" || ext === ".ts";
  const isMarkdown = ext === ".md";
  if (!isCode && !isMarkdown) {
    return;
  }

  const original = fs.readFileSync(destPath, "utf8");
  let next = original;

  if (isMarkdown) {
    // The published tarball must not mention internal workspace package
    // specifiers that won't exist on npm. Avoid rewriting docs to private
    // "#..." specifiers; use unscoped names for readability.
    const markdownRewrites = new Map([
      ["@rybosome/tspice-core", "tspice-core"],
      ["@rybosome/tspice-backend-", "tspice-backend-"],
    ]);

    for (const [from, to] of markdownRewrites.entries()) {
      next = next.replaceAll(from, to).replaceAll(`${from}/`, `${to}/`);
    }

    if (next !== original) {
      fs.writeFileSync(destPath, next);
    }
    return;
  }

  for (const [from, to] of SPECIFIER_REWRITES.entries()) {
    // Replace only in string literal import specifiers.
    // This intentionally avoids trying to parse JS/TS.
    next = next
      // Double-quoted literals: normal + escaped (e.g. in generated strings).
      .replaceAll(`"${from}"`, `"${to}"`)
      .replaceAll(`\"${from}\"`, `\"${to}\"`)
      // Single-quoted literals.
      .replaceAll(`'${from}'`, `'${to}'`)
      // Subpath imports.
      .replaceAll(`"${from}/`, `"${to}/`)
      .replaceAll(`\"${from}/`, `\"${to}/`)
      .replaceAll(`'${from}/`, `'${to}/`);
  }

  // Some build outputs embed source code as JSON-stringified blobs (for example
  // the inline worker source string). Those blobs contain escaped quotes like
  // `\\\"...\\\"`, which the simple string-literal rewrites above may miss.
  //
  // Run an additional pass that explicitly targets escaped double quotes and
  // also includes a raw fallback to ensure the published tarball doesn't
  // mention workspace-only package specifiers.
  for (const [from, to] of SPECIFIER_REWRITES.entries()) {
    const escapedDqFrom = "\\\"" + from + "\\\"";
    const escapedDqTo = "\\\"" + to + "\\\"";
    const escapedDqSubFrom = "\\\"" + from + "/";
    const escapedDqSubTo = "\\\"" + to + "/";

    next = next
      .replaceAll(escapedDqFrom, escapedDqTo)
      .replaceAll(escapedDqSubFrom, escapedDqSubTo)
      .replaceAll(from, to);
  }

  if (next !== original) {
    fs.writeFileSync(destPath, next);
  }
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Missing directory: ${srcDir}. Did you run pnpm -w build?`);
  }

  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
      continue;
    }

    if (!shouldCopyFile(entry.name)) {
      continue;
    }

    copyFile(srcPath, destPath);
    rewriteSpecifiersInFile(destPath);
  }
}

function buildExports() {
  return {
    ".": {
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    },
  };
}

function main() {
  const tspicePkg = readJson(path.join(tspiceRoot, "package.json"));

  // Clean.
  rmrf(distPublishRoot);
  ensureDir(distPublishRoot);

  // Copy build outputs.
  copyDir(path.join(tspiceRoot, "dist"), path.join(distPublishRoot, "dist"));

  // Copy internal workspace packages.
  const internalPackages = [
    { dir: "backend-contract", dest: "backend-contract" },
    { dir: "core", dest: "core" },
    { dir: "backend-fake", dest: "backend-fake" },
    { dir: "backend-wasm", dest: "backend-wasm" },
    { dir: "backend-node", dest: "backend-node" },
  ];

  for (const p of internalPackages) {
    const pkgRoot = path.join(repoRoot, "packages", p.dir);

    // Copy LICENSE / NOTICE when present.
    for (const file of ["LICENSE", "NOTICE"]) {
      const src = path.join(pkgRoot, file);
      if (fs.existsSync(src)) {
        copyFile(src, path.join(distPublishRoot, p.dest, file));
      }
    }

    copyDir(path.join(pkgRoot, "dist"), path.join(distPublishRoot, p.dest, "dist"));
  }

  // Top-level docs/compliance.
  for (const file of ["README.md", "LICENSE"]) {
    const src = path.join(tspiceRoot, file);
    if (fs.existsSync(src)) {
      const dest = path.join(distPublishRoot, file);
      copyFile(src, dest);
      rewriteSpecifiersInFile(dest);
    }
  }

  // Create a combined NOTICE file (NPM expects a top-level NOTICE for some
  // consumers, and our current third-party notices live in per-backend files).
  const notices = [];
  for (const noticePath of [
    path.join(repoRoot, "packages", "backend-node", "NOTICE"),
    path.join(repoRoot, "packages", "backend-wasm", "NOTICE"),
  ]) {
    if (fs.existsSync(noticePath)) {
      notices.push(fs.readFileSync(noticePath, "utf8").trim());
    }
  }
  if (notices.length) {
    fs.writeFileSync(path.join(distPublishRoot, "NOTICE"), notices.join("\n\n") + "\n");
  }

  const version = tspicePkg.version;

  const distPublishPkg = {
    name: tspicePkg.name,
    version,
    license: tspicePkg.license,
    type: "module",

    // Internal-only aliases for the vendored workspace packages.
    // These are *not* available to consumers; only modules within this package
    // can import "#..." specifiers.
    imports: {
      "#core": "./core/dist/index.js",
      "#backend-contract": "./backend-contract/dist/index.js",
      "#backend-fake": "./backend-fake/dist/index.js",
      "#backend-wasm": {
        browser: "./backend-wasm/dist/index.web.js",
        node: "./backend-wasm/dist/index.node.js",
        default: "./backend-wasm/dist/index.web.js",
      },
      "#backend-node": "./backend-node/dist/index.js",
    },

    // ESM entrypoints.
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: buildExports(),

    // Platform-native packages (optional install).
    optionalDependencies: {
      "@rybosome/tspice-native-darwin-arm64": version,
      "@rybosome/tspice-native-darwin-x64": version,
      "@rybosome/tspice-native-linux-x64-gnu": version,
    },

    // Keep publish output tight.
    files: [
      "dist",
      "backend-contract",
      "core",
      "backend-fake",
      "backend-wasm",
      "backend-node",
      "README.md",
      "LICENSE",
      "NOTICE",
    ],

    publishConfig: {
      access: "public",
    },
  };

  writeJson(path.join(distPublishRoot, "package.json"), distPublishPkg);

  // Sanity: ensure the package can be packed.
  // (We don't run npm here; `verify-dist-publish.mjs` does.)
  if (!fs.existsSync(path.join(distPublishRoot, "package.json"))) {
    throw new Error("dist-publish/package.json was not created");
  }
}

main();
