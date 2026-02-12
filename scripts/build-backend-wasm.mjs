import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WASM_BINARY_FILENAME,
  WASM_NODE_JS_FILENAME,
  WASM_WEB_JS_FILENAME,
} from "./backend-wasm-assets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WASM_MEMORY_PAGE_BYTES = 64 * 1024;
const DEFAULT_WASM_INITIAL_MEMORY_BYTES = 128 * 1024 * 1024;

function readWasmInitialMemoryBytes() {
  const raw = process.env.TSPICE_WASM_INITIAL_MEMORY;
  if (raw == null || raw.trim() === "") {
    console.log(
      `Using default wasm INITIAL_MEMORY=${DEFAULT_WASM_INITIAL_MEMORY_BYTES} bytes (set TSPICE_WASM_INITIAL_MEMORY to override)`,
    );
    return DEFAULT_WASM_INITIAL_MEMORY_BYTES;
  }

  if (!/^[0-9]+$/.test(raw.trim())) {
    throw new Error(
      `TSPICE_WASM_INITIAL_MEMORY must be a positive integer (bytes). Got: ${JSON.stringify(raw)}`,
    );
  }

  const bytes = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error(
      `TSPICE_WASM_INITIAL_MEMORY must be a positive integer (bytes). Got: ${JSON.stringify(raw)}`,
    );
  }

  if (bytes % WASM_MEMORY_PAGE_BYTES !== 0) {
    throw new Error(
      `TSPICE_WASM_INITIAL_MEMORY must be ${WASM_MEMORY_PAGE_BYTES}-byte (64KiB) aligned. Got: ${bytes}`,
    );
  }

  console.log(`Using wasm INITIAL_MEMORY=${bytes} bytes from TSPICE_WASM_INITIAL_MEMORY`);
  return bytes;
}

const wasmInitialMemoryBytes = readWasmInitialMemoryBytes();

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
// This directory contains locally staged CSPICE sources (including patched copies).
// It must never be committed.
{
  function isSubdir(parent, child) {
    const rel = path.relative(parent, child);
    if (rel === "") {
      return false;
    }
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      return false;
    }
    return true;
  }

  const cacheRoot = path.resolve(wasmBuildCacheDir);
  const buildRoot = path.resolve(wasmBuildDir);
  if (!isSubdir(cacheRoot, buildRoot)) {
    throw new Error(`Expected wasm build dir to be under ${cacheRoot}, got: ${buildRoot}`);
  }
}
fs.rmSync(wasmBuildDir, { recursive: true, force: true });
fs.mkdirSync(wasmBuildDir, { recursive: true });

// All CSPICE patching happens in this build tree; the downloaded sources remain untouched.
const patchedCspiceSourceRoot = path.join(wasmBuildDir, "cspice");
fs.cpSync(cspiceSourceRoot, patchedCspiceSourceRoot, { recursive: true });

const shimSources = [
  path.join(repoRoot, "packages", "backend-shim-c", "src", "errors.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "handle_validation.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "kernels.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "kernel_pool.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "time.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "ids_names.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "frames.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "ephemeris.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "geometry.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "coords_vectors.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "file_io.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "cells_windows.c"),
  path.join(repoRoot, "packages", "backend-shim-c", "src", "domains", "dsk.c"),
];
const shimIncludeDir = path.join(repoRoot, "packages", "backend-shim-c", "include");
const outputDir = path.join(repoRoot, "packages", "backend-wasm", "emscripten");
const outputWebJsPath = path.join(outputDir, WASM_WEB_JS_FILENAME);
const outputNodeJsPath = path.join(outputDir, WASM_NODE_JS_FILENAME);

for (const shimPath of shimSources) {
  if (!fs.existsSync(shimPath)) {
    throw new Error(`Missing shared shim C file at ${shimPath}`);
  }
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

const sources = [...shimSources, ...collectCFiles(cspiceCspiceDir), ...collectCFiles(cspiceCsupportDir)];

const includeDirs = [
  shimIncludeDir,
  path.join(patchedCspiceSourceRoot, "include"),
  cspiceSrcDir,
  cspiceCspiceDir,
  cspiceCsupportDir,
].flatMap((dir) => ["-I", dir]);

fs.mkdirSync(outputDir, { recursive: true });

const exportedRuntimeMethods = [
  "UTF8ToString",
  "stringToUTF8",
  "lengthBytesUTF8",
  "FS",
  "HEAP8",
  "HEAPU8",
  "HEAP16",
  "HEAPU16",
  "HEAP32",
  "HEAPU32",
  "HEAPF32",
  "HEAPF64",
];

const exportedFunctions = [
  // --- error/status utilities ---
  "_tspice_get_last_error_short",
  "_tspice_get_last_error_long",
  "_tspice_get_last_error_trace",
  "_tspice_failed",
  "_tspice_reset",
  "_tspice_getmsg",
  "_tspice_setmsg",
  "_tspice_sigerr",
  "_tspice_chkin",
  "_tspice_chkout",

  // --- kernels ---
  "_tspice_tkvrsn_toolkit",
  "_tspice_furnsh",
  "_tspice_unload",
  "_tspice_kclear",
  "_tspice_ktotal",
  "_tspice_kdata",
  // NOTE: not required by the TS bindings, but handy for debugging.
  "_tspice_ktotal_all",

  // --- file i/o primitives ---
  "_tspice_exists",
  "_tspice_getfat",

  // --- DAF ---
  "_tspice_dafopr",
  "_tspice_dafcls",
  "_tspice_dafbfs",
  "_tspice_daffna",

  // --- DAS ---
  "_tspice_dasopr",
  "_tspice_dascls",

  // --- DLA (DAS-backed) ---
  "_tspice_dlaopn",
  "_tspice_dlabfs",
  "_tspice_dlafns",
  "_tspice_dlacls",

  // --- DSK ---
  "_tspice_dskobj",
  "_tspice_dsksrf",
  "_tspice_dskgd",
  "_tspice_dskb02",


  // --- kernel pool ---
  "_tspice_gdpool",
  "_tspice_gipool",
  "_tspice_gcpool",
  "_tspice_gnpool",
  "_tspice_dtpool",
  "_tspice_pdpool",
  "_tspice_pipool",
  "_tspice_pcpool",
  "_tspice_swpool",
  "_tspice_cvpool",
  "_tspice_expool",

  // --- time ---
  "_tspice_str2et",
  "_tspice_et2utc",
  "_tspice_timout",
  "_tspice_deltet",
  "_tspice_unitim",
  "_tspice_tparse",
  "_tspice_tpictr",
  "_tspice_timdef_get",
  "_tspice_timdef_set",
  "_tspice_scencd",
  "_tspice_scdecd",
  "_tspice_sct2e",
  "_tspice_sce2c",

  // --- ids/names ---
  "_tspice_bodn2c",
  "_tspice_bodc2n",
  "_tspice_bodc2s",
  "_tspice_bods2c",
  "_tspice_boddef",
  "_tspice_bodfnd",
  "_tspice_bodvar",

  // --- frames ---
  "_tspice_namfrm",
  "_tspice_frmnam",
  "_tspice_cidfrm",
  "_tspice_cnmfrm",
  "_tspice_frinfo",
  "_tspice_ccifrm",
  "_tspice_scs2e",
  "_tspice_sce2s",
  "_tspice_ckgp",
  "_tspice_ckgpav",
  "_tspice_pxform",
  "_tspice_sxform",

  // --- ephemeris ---
  "_tspice_spkezr",
  "_tspice_spkpos",
  "_tspice_spkez",
  "_tspice_spkezp",
  "_tspice_spkgeo",
  "_tspice_spkgps",
  "_tspice_spkssb",
  "_tspice_spkcov",
  "_tspice_spkobj",
  "_tspice_spksfs",
  "_tspice_spkpds",
  "_tspice_spkuds",

  // --- derived geometry ---
  "_tspice_subpnt",
  "_tspice_subslr",
  "_tspice_sincpt",
  "_tspice_ilumin",
  "_tspice_occult",

  // --- coords/vectors ---
  "_tspice_reclat",
  "_tspice_latrec",
  "_tspice_recsph",
  "_tspice_sphrec",
  "_tspice_vnorm",
  "_tspice_vhat",
  "_tspice_vdot",
  "_tspice_vcrss",
  "_tspice_mxv",
  "_tspice_mtxv",
  "_tspice_mxm",
  "_tspice_vadd",
  "_tspice_vsub",
  "_tspice_vminus",
  "_tspice_vscl",
  "_tspice_rotate",
  "_tspice_rotmat",
  "_tspice_axisar",
  "_tspice_georec",
  "_tspice_recgeo",

  // --- cells/windows ---
  "_tspice_new_int_cell",
  "_tspice_new_double_cell",
  "_tspice_new_char_cell",
  "_tspice_new_window",
  "_tspice_free_cell",
  "_tspice_free_window",
  "_tspice_ssize",
  "_tspice_scard",
  "_tspice_card",
  "_tspice_size",
  "_tspice_valid",
  "_tspice_insrti",
  "_tspice_insrtd",
  "_tspice_insrtc",
  "_tspice_cell_geti",
  "_tspice_cell_getd",
  "_tspice_cell_getc",
  "_tspice_wninsd",
  "_tspice_wncard",
  "_tspice_wnfetd",
  "_tspice_wnvald",

  // --- memory ---
  "_malloc",
  "_free",
];

const commonEmccArgs = [
  // We need C11 for shared shim sources (e.g. <stdatomic.h>).
  // `gnu11` keeps GNU extensions enabled for the upstream CSPICE sources.
  "-std=gnu11",
  "-Wno-implicit-int",
  "-O2",
  "-s",
  "MODULARIZE=1",
  "-s",
  "EXPORT_ES6=1",
  "-s",
  "ALLOW_MEMORY_GROWTH=1",
  "-s",
  // Some Emscripten toolchains require initial memory to cover static data.
  // (ALLOW_MEMORY_GROWTH does not help at link time.)
  // Default: 128MiB. Override with TSPICE_WASM_INITIAL_MEMORY (bytes, 64KiB-aligned).
  `INITIAL_MEMORY=${wasmInitialMemoryBytes}`,
  "-s",
  "FORCE_FILESYSTEM=1",
  "-s",
  `EXPORTED_RUNTIME_METHODS=['${exportedRuntimeMethods.join("','")}']`,
  "-s",
  `EXPORTED_FUNCTIONS=['${exportedFunctions.join("','")}']`,
];

function runEmcc({ environment, outputJsPath }) {
  execFileSync(
    "emcc",
    [
      ...commonEmccArgs,
      "-s",
      `ENVIRONMENT=${environment}`,
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
}

runEmcc({ environment: "web,worker", outputJsPath: outputWebJsPath });
runEmcc({ environment: "node", outputJsPath: outputNodeJsPath });

const outputWebWasmPath = outputWebJsPath.replace(/\.js$/, ".wasm");
const outputNodeWasmPath = outputNodeJsPath.replace(/\.js$/, ".wasm");
const outputWasmPath = path.join(outputDir, WASM_BINARY_FILENAME);

if (!fs.existsSync(outputWebWasmPath)) {
  throw new Error(`Expected Emscripten to write ${outputWebWasmPath} but it was missing`);
}
if (!fs.existsSync(outputNodeWasmPath)) {
  throw new Error(`Expected Emscripten to write ${outputNodeWasmPath} but it was missing`);
}

// emcc derives the wasm filename from the JS glue output filename (e.g. *.web.wasm / *.node.wasm).
// Keep a single checked-in wasm artifact, and patch both JS outputs to reference it.
{
  const web = fs.readFileSync(outputWebWasmPath);
  const node = fs.readFileSync(outputNodeWasmPath);
  if (web.length !== node.length || !web.equals(node)) {
    throw new Error(
      `Expected web/node wasm outputs to be identical, but they differ:\n` +
        `- ${outputWebWasmPath}\n` +
        `- ${outputNodeWasmPath}`,
    );
  }
}

fs.copyFileSync(outputWebWasmPath, outputWasmPath);

{
  const webWasmBasename = path.basename(outputWebWasmPath);
  const nodeWasmBasename = path.basename(outputNodeWasmPath);

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\[\]\\]/g, "\$&");

  const patchWasmBasename = (jsPath, oldBasename) => {
    const jsContents = fs.readFileSync(jsPath, "utf8");

    // Only patch quoted occurrences of the derived wasm filename.
    const re = new RegExp(`(['"])${escapeRegExp(oldBasename)}\\1`, "g");
    const patched = jsContents.replace(re, `$1${WASM_BINARY_FILENAME}$1`);
    if (patched === jsContents) {
      throw new Error(`Expected to patch wasm basename in ${jsPath} but no changes were made`);
    }

    if (patched.includes(oldBasename)) {
      throw new Error(`Expected ${jsPath} to no longer reference ${oldBasename} after patching`);
    }
    if (!patched.includes(WASM_BINARY_FILENAME)) {
      throw new Error(`Expected ${jsPath} to reference ${WASM_BINARY_FILENAME} after patching`);
    }

    fs.writeFileSync(jsPath, patched);
  };

  patchWasmBasename(outputWebJsPath, webWasmBasename);
  patchWasmBasename(outputNodeJsPath, nodeWasmBasename);
}

fs.rmSync(outputWebWasmPath);
fs.rmSync(outputNodeWasmPath);

const generatedHeader = `// GENERATED FILE - DO NOT EDIT.\n// Regenerate via: node scripts/build-backend-wasm.mjs\n\n`;

function ensureGeneratedHeader(jsPath) {
  const jsContents = fs.readFileSync(jsPath, "utf8");
  if (!jsContents.startsWith(generatedHeader)) {
    fs.writeFileSync(jsPath, `${generatedHeader}${jsContents}`);
  }
}

function rewriteWasmFilename(jsPath, emittedWasmBasename) {
  const jsContents = fs.readFileSync(jsPath, "utf8");
  const next = jsContents.replaceAll(emittedWasmBasename, WASM_BINARY_FILENAME);
  if (next !== jsContents) {
    fs.writeFileSync(jsPath, next);
  }
}

// Emscripten still emits Node-only glue that assumes CommonJS globals
// (`__dirname`, `require`). Inject them so the generated output works as ESM.
const nodeEsmPreambleSentinel = "// tspice-backend-wasm:node-esm-preamble";
const nodeEsmPreamble = [
  nodeEsmPreambleSentinel,
  'import { createRequire } from "node:module";',
  'import { dirname } from "node:path";',
  'import { fileURLToPath } from "node:url";',
  "",
  "const require = createRequire(import.meta.url);",
  "const __dirname = dirname(fileURLToPath(import.meta.url));",
  "",
].join("\n");

function ensureNodeEsmPreamble(jsPath) {
  const jsContents = fs.readFileSync(jsPath, "utf8");
  if (!jsContents.startsWith(generatedHeader)) {
    throw new Error(`Expected ${jsPath} to start with generated header`);
  }
  if (jsContents.includes(nodeEsmPreambleSentinel)) {
    return;
  }
  // Some Emscripten builds already include a createRequire() preamble; avoid duplicating it.
  if (jsContents.includes("createRequire(import.meta.url)")) {
    return;
  }
  fs.writeFileSync(jsPath, `${generatedHeader}${nodeEsmPreamble}${jsContents.slice(generatedHeader.length)}`);
}

for (const jsPath of [outputWebJsPath, outputNodeJsPath]) {
  ensureGeneratedHeader(jsPath);
}

rewriteWasmFilename(outputWebJsPath, path.basename(outputWebWasmPath));
rewriteWasmFilename(outputNodeJsPath, path.basename(outputNodeWasmPath));

ensureNodeEsmPreamble(outputNodeJsPath);

console.log(`Wrote ${outputWebJsPath}`);
console.log(`Wrote ${outputNodeJsPath}`);
