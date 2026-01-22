import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WASM_BINARY_FILENAME, WASM_JS_FILENAME } from "./backend-wasm-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cspiceManifestPath = path.join(repoRoot, "scripts", "cspice.manifest.json");
const { toolkitVersion } = JSON.parse(fs.readFileSync(cspiceManifestPath, "utf8"));

const cspiceSourceRoot = path.join(
  repoRoot,
  ".cache",
  "cspice",
  toolkitVersion,
  "source",
  "cspice",
);

execFileSync("node", [path.join(repoRoot, "scripts", "fetch-cspice.mjs"), "--source"], {
  cwd: repoRoot,
  stdio: "inherit",
});

const wasmBuildCacheDir = path.join(repoRoot, ".cache");
fs.mkdirSync(wasmBuildCacheDir, { recursive: true });

const wasmBuildDir = path.join(wasmBuildCacheDir, "wasm-build");
fs.rmSync(wasmBuildDir, { recursive: true, force: true });
fs.mkdirSync(wasmBuildDir, { recursive: true });

// All CSPICE patching happens in this build tree; the downloaded sources remain untouched.
const patchedCspiceSourceRoot = path.join(wasmBuildDir, "cspice");
fs.cpSync(cspiceSourceRoot, patchedCspiceSourceRoot, { recursive: true });

const wrapperPath = path.join(
  repoRoot,
  "packages",
  "backend-wasm",
  "emscripten",
  "tspice_backend_wasm_wrapper.c",
);
const outputDir = path.join(repoRoot, "packages", "backend-wasm", "emscripten");
const outputJsPath = path.join(outputDir, WASM_JS_FILENAME);

if (!fs.existsSync(wrapperPath)) {
  throw new Error(`Missing wrapper C file at ${wrapperPath}`);
}

const cspiceSrcDir = path.join(patchedCspiceSourceRoot, "src");
const cspiceCspiceDir = path.join(cspiceSrcDir, "cspice");
const cspiceCsupportDir = path.join(cspiceSrcDir, "csupport");

function patchReturnInt(filePath, symbol, indentation = "") {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const original = fs.readFileSync(filePath, "utf8");
  let contents = original;

  if (!original.includes(symbol)) {
    throw new Error(`Expected to find ${symbol} in ${filePath} but did not`);
  }

  const needsPatch =
    new RegExp(`\\bvoid\\s+${symbol}\\s*\\(`, "g").test(original) ||
    new RegExp(`\\bVOID\\s+${symbol}\\s*\\(`, "g").test(original) ||
    (symbol === "s_cat" && /\bVOID\s*\n/.test(original));

  contents = contents.replaceAll(
    new RegExp(`\\bvoid\\s+${symbol}\\s*\\(`, "g"),
    `int ${symbol}(`,
  );
  contents = contents.replaceAll(
    new RegExp(`\\bVOID\\s+${symbol}\\s*\\(`, "g"),
    `int ${symbol}(`,
  );

  if (symbol === "s_cat") {
    contents = contents.replace(/\bVOID\s*\n/, "int\n");
  }

  if (!contents.includes(`return 0;`)) {
    const idx = contents.lastIndexOf("}");
    if (idx === -1) {
      throw new Error(`Failed to patch ${filePath}: missing closing brace`);
    }
    contents = `${contents.slice(0, idx)}${indentation}return 0;\n${contents.slice(idx)}`;
  }

  if (contents !== original) {
    console.log(`Patched ${symbol} in ${filePath}`);
    fs.writeFileSync(filePath, contents);
  } else if (needsPatch) {
    throw new Error(`Expected to patch ${symbol} in ${filePath}, but no changes were made`);
  }
}

patchReturnInt(path.join(cspiceCspiceDir, "s_copy.c"), "s_copy", "\t");
patchReturnInt(path.join(cspiceCspiceDir, "s_cat.c"), "s_cat", "\t");
patchReturnInt(path.join(cspiceCspiceDir, "getenv_.c"), "getenv_", "   ");
patchReturnInt(path.join(cspiceCspiceDir, "rsfe.c"), "zzsetnnread_", "   ");

{
  const ef1ascPath = path.join(cspiceCspiceDir, "ef1asc_.c");
  if (fs.existsSync(ef1ascPath)) {
    const original = fs.readFileSync(ef1ascPath, "utf8");
    const contents = original.replaceAll(
      /\bextern\s+void\s+s_copy\s*\(/g,
      "extern int s_copy(",
    );
    if (contents !== original) {
      console.log(`Patched s_copy declaration in ${ef1ascPath}`);
      fs.writeFileSync(ef1ascPath, contents);
    }
  }
}

function collectCFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectCFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".c")) {
      out.push(entryPath);
    }
  }
  return out;
}

const sources = [
  wrapperPath,
  ...collectCFiles(cspiceCspiceDir),
  ...collectCFiles(cspiceCsupportDir),
];

const includeDirs = [
  path.join(patchedCspiceSourceRoot, "include"),
  cspiceSrcDir,
  cspiceCspiceDir,
  cspiceCsupportDir,
].flatMap((dir) => ["-I", dir]);

fs.mkdirSync(outputDir, { recursive: true });

execFileSync(
  "emcc",
  [
    "-std=gnu89",
    "-O2",
    "-s",
    "MODULARIZE=1",
    "-s",
    "EXPORT_ES6=1",
    "-s",
    "ENVIRONMENT=web,worker,node",
    "-s",
    "ALLOW_MEMORY_GROWTH=1",
    "-s",
    "EXPORTED_RUNTIME_METHODS=['UTF8ToString','FS']",
    "-s",
    "EXPORTED_FUNCTIONS=['_tspice_tkvrsn_toolkit','_tspice_furnsh','_tspice_unload','_tspice_kclear','_tspice_ktotal','_tspice_kdata','_tspice_str2et','_tspice_et2utc','_tspice_timout','_malloc','_free']",
    "-o",
    outputJsPath,
    ...includeDirs,
    ...sources,
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

const outputWasmPath = path.join(outputDir, WASM_BINARY_FILENAME);
if (!fs.existsSync(outputWasmPath)) {
  throw new Error(`Expected Emscripten to write ${outputWasmPath} but it was missing`);
}

const generatedHeader = `// GENERATED FILE - DO NOT EDIT.\n// Regenerate via: node scripts/build-backend-wasm.mjs\n\n`;
const jsContents = fs.readFileSync(outputJsPath, "utf8");
if (!jsContents.startsWith(generatedHeader)) {
  fs.writeFileSync(outputJsPath, `${generatedHeader}${jsContents}`);
}

console.log(`Wrote ${outputJsPath}`);
