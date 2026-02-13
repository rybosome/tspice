#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CSPICE_INDEX_URL =
  "https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/index.html";

const REPO_ROOT = path.resolve(process.cwd());
const BACKEND_CONTRACT_INDEX_PATH = path.join(
  REPO_ROOT,
  "packages/backend-contract/src/index.ts",
);
const CSPICE_FUNCTIONS_JSON_PATH = path.join(
  REPO_ROOT,
  "data/cspice-functions.json",
);
const OUTPUT_PATH = path.join(REPO_ROOT, "docs/cspice-function-inventory.md");

function normalizeRoutineName(name) {
  const lower = name.toLowerCase();
  return lower.endsWith("_c") ? lower.slice(0, -2) : lower;
}

function shouldOmitTargetSupport({ name, purpose }) {
  // Keep omissions minimal.

  // (1) Interactive terminal I/O / command-line parsing.
  if (new Set(["prompt_c", "getcml_c"]).has(name)) {
    return {
      omit: true,
      justification: "interactive I/O / CLI",
    };
  }

  // (2) Fortran unit file I/O shims are not meaningful in tspice.
  if (/^ftn[a-z0-9]*_c$/.test(name) || purpose.toLowerCase().includes("fortran unit")) {
    return {
      omit: true,
      justification: "Fortran unit I/O (non-portable)",
    };
  }

  return { omit: false, justification: "" };
}

function parseCspiceIndexHtml(html) {
  const flattened = html.replace(/\s+/g, " ");

  const anchorCount = (flattened.match(/<LI><SAMP><A HREF/gi) ?? []).length;

  /** @type {{name: string; purpose: string}[]} */
  const routines = [];

  // Example:
  // <LI><SAMP><A HREF="furnsh_c.html">FURNSH_C</A> -  Furnish a program with SPICE kernels  </SAMP></LI>
  const entryRe =
    /<LI><SAMP><A HREF="[^"]+">([^<]+)<\/A>\s*-\s*(.*?)\s*<\/SAMP><\/LI>/gi;

  let match;
  while ((match = entryRe.exec(flattened))) {
    const rawName = match[1].trim();
    const rawPurpose = match[2].trim();

    // NAIF uses upper-case in the index.
    const name = rawName.toLowerCase();
    const purpose = rawPurpose.replace(/\s+/g, " ").trim();

    // Skip any oddities that aren't routine names.
    if (!name) continue;

    routines.push({ name, purpose });
  }

  // Deduplicate just in case.
  const byName = new Map();
  for (const r of routines) {
    byName.set(r.name, r);
  }

  const parsed = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (anchorCount !== 0 && parsed.length !== anchorCount) {
    throw new Error(
      `Parsed CSPICE routine count mismatch: parsed=${parsed.length} htmlAnchors=${anchorCount}`,
    );
  }

  return parsed;
}

async function fetchCspiceIndex() {
  const res = await fetch(CSPICE_INDEX_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch CSPICE index: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function usage() {
  return [
    "Usage: node scripts/generate-cspice-inventory.mjs [--refresh-from-naif|--check]",
    "",
    "Default: reads data/cspice-functions.json and regenerates docs/cspice-function-inventory.md.",
    "",
    "Modes:",
    "  --refresh-from-naif  Fetch NAIF index and update/merge data/cspice-functions.json.",
    "  --check              Fail if data/cspice-functions.json drifts from NAIF index.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = new Set(argv);

  if (args.has("--help") || args.has("-h")) {
    process.stdout.write(usage() + "\n");
    process.exit(0);
  }

  const refreshFromNaif = args.has("--refresh-from-naif");
  const check = args.has("--check");

  const allowed = new Set(["--refresh-from-naif", "--check"]);
  for (const a of args) {
    if (a.startsWith("-") && !allowed.has(a)) {
      throw new Error(`Unknown arg: ${a}\n\n${usage()}`);
    }
  }

  if (refreshFromNaif && check) {
    throw new Error(`Cannot combine --refresh-from-naif and --check.\n\n${usage()}`);
  }

  return { refreshFromNaif, check };
}

function extractInterfaceBody(sourceText, interfaceName) {
  // We avoid a TypeScript AST dependency here.
  // This is a simple balanced-braces extractor for:
  //   export interface Foo { ... }
  //   export interface Foo extends Bar { ... }

  const interfaceRe = new RegExp(
    `export\\s+interface\\s+${interfaceName}\\b[^\\{]*\\{`,
    "m",
  );

  const match = interfaceRe.exec(sourceText);
  if (!match) {
    throw new Error(`Could not find interface ${interfaceName}`);
  }

  const start = match.index + match[0].lastIndexOf("{") + 1;

  let depth = 1;
  for (let i = start; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) {
      return sourceText.slice(start, i);
    }
  }

  throw new Error(`Unbalanced braces while parsing interface ${interfaceName}`);
}

function collectInterfaceMethodNames(interfaceBody) {
  /** @type {string[]} */
  const names = [];
  const methodRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:<[^>]*>)?\s*\(/gm;

  let match;
  while ((match = methodRe.exec(interfaceBody))) {
    const name = match[1];

    // SpiceBackend also includes a small number of convenience helpers that
    // aren't 1:1 CSPICE bindings (e.g. camelCase helpers). We only treat
    // lower-case identifiers as CSPICE routine names.
    if (!/^[a-z0-9_]+$/.test(name)) continue;

    names.push(name);
  }

  return names;
}

function parseNamedImportsByName(sourceText) {
  /** @type {Map<string, string>} */
  const importByName = new Map();
  const importRe =
    /import\s+type\s+\{\s*([^}]+)\s*\}\s+from\s+"([^"]+)"\s*;/g;

  let match;
  while ((match = importRe.exec(sourceText))) {
    const namesPart = match[1];
    const from = match[2];
    for (const raw of namesPart.split(",")) {
      const name = raw.trim();
      if (!name) continue;
      importByName.set(name, from);
    }
  }

  return importByName;
}

function parseSpiceBackendExtendsList(sourceText) {
  const re = /export\s+interface\s+SpiceBackend\s+extends\s+([\s\S]*?)\s*\{/m;
  const match = re.exec(sourceText);
  if (!match) {
    throw new Error("Could not find SpiceBackend interface extends list");
  }

  const raw = match[1];
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error("SpiceBackend extends list is empty");
  }

  return names;
}

async function collectImplementedRoutineNamesFromSpiceBackend() {
  const indexText = await readFile(BACKEND_CONTRACT_INDEX_PATH, "utf8");
  const extendsNames = parseSpiceBackendExtendsList(indexText);
  const importByName = parseNamedImportsByName(indexText);

  /** @type {Set<string>} */
  const methodNames = new Set();

  const indexDir = path.dirname(BACKEND_CONTRACT_INDEX_PATH);

  for (const interfaceName of extendsNames) {
    const importPath = importByName.get(interfaceName);
    if (!importPath) {
      throw new Error(
        `SpiceBackend extends ${interfaceName} but ${interfaceName} is not imported in backend-contract index.ts`,
      );
    }

    // backend-contract uses .js specifiers even in .ts sources.
    const importPathTs = importPath.endsWith(".js")
      ? importPath.slice(0, -3) + ".ts"
      : importPath;

    const absPath = path.resolve(indexDir, importPathTs);
    const sourceText = await readFile(absPath, "utf8");
    const body = extractInterfaceBody(sourceText, interfaceName);
    const methods = collectInterfaceMethodNames(body);
    for (const m of methods) {
      methodNames.add(m);
    }
  }

  /** @type {Set<string>} */
  const normalized = new Set();
  for (const m of methodNames) {
    normalized.add(normalizeRoutineName(m.toLowerCase()));
  }

  return { extendsNames, methodNames, normalized };
}

function loadCspiceFunctionsJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected data/cspice-functions.json to be a JSON array");
  }

  for (const [i, item] of parsed.entries()) {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid item at index ${i}: expected object`);
    }
    if (typeof item.name !== "string") {
      throw new Error(`Invalid item at index ${i}: missing string 'name'`);
    }
    if (typeof item.purpose !== "string") {
      throw new Error(`Invalid item at index ${i}: missing string 'purpose'`);
    }
    if (item.decision !== "planned" && item.decision !== "excluded") {
      throw new Error(
        `Invalid item at index ${i}: decision must be 'planned' or 'excluded'`,
      );
    }
    if (item.justification != null && typeof item.justification !== "string") {
      throw new Error(`Invalid item at index ${i}: justification must be string`);
    }
  }

  return parsed;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function autoDecisionForNewRoutine({ name, purpose }) {
  const { omit, justification } = shouldOmitTargetSupport({ name, purpose });
  if (omit) {
    return { decision: "excluded", justification };
  }
  return { decision: "planned" };
}

function mergeCspiceFunctionsFromNaif({ existing, naifRoutines }) {
  const existingByName = new Map(existing.map((r) => [r.name, r]));

  const merged = naifRoutines.map((r) => {
    const prev = existingByName.get(r.name);
    if (!prev) {
      return { ...r, ...autoDecisionForNewRoutine(r) };
    }

    // Keep repo-owned fields, but refresh the NAIF purpose line.
    return {
      ...prev,
      purpose: r.purpose,
      decision: prev.decision ?? "planned",
    };
  });

  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

function escapeTableCell(text) {
  return text.replace(/\|/g, "\\|");
}

function formatBacktickedList(names) {
  return names.map((n) => "`" + n + "`").join(", ");
}

function renderSpiceBackendCompositionLine(extendsNames) {
  return `SpiceBackend is composed from: ${formatBacktickedList(extendsNames)}.`;
}

function renderTable({ rows, includeDecision, includeJustification }) {
  const lines = [];

  const headers = ["Routine", "Purpose (1 line)"];
  if (includeDecision) headers.push("Decision");
  if (includeJustification) headers.push("Notes");

  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const r of rows) {
    const cells = [`\`${r.name}\``, escapeTableCell(r.purpose)];
    if (includeDecision) cells.push(r.decision);
    if (includeJustification) cells.push(escapeTableCell(r.justification ?? ""));
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function renderMarkdown({ functions, implementedNormalized, extendsNames }) {
  const lines = [];

  lines.push("# CSPICE routine inventory");
  lines.push("");
  lines.push(
    "This file is generated by `node scripts/generate-cspice-inventory.mjs`.",
  );
  lines.push(
    "The canonical routine list + decisions live in `data/cspice-functions.json`.",
  );
  lines.push("");
  lines.push("Sources:");
  lines.push(
    `- CSPICE routine list + brief descriptions: ${CSPICE_INDEX_URL} (NAIF official index)`,
  );
  lines.push(
    "- tspice implemented routines: backend contract surface via `SpiceBackend` in `packages/backend-contract/src/index.ts`",
  );
  lines.push("");
  lines.push(renderSpiceBackendCompositionLine(extendsNames));
  lines.push("");

  const implementedNow = [];
  const planned = [];
  const excluded = [];

  for (const f of functions) {
    const normalized = normalizeRoutineName(f.name);
    const isImplementedNow = implementedNormalized.has(normalized);

    if (isImplementedNow) {
      implementedNow.push(f);
    } else if (f.decision === "excluded") {
      excluded.push(f);
    } else {
      planned.push(f);
    }
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total routines (NAIF index): ${functions.length}`);
  lines.push(`- Implemented now (SpiceBackend): ${implementedNow.length}`);
  lines.push(`- Planned (not yet implemented): ${planned.length}`);
  lines.push(`- Excluded: ${excluded.length}`);
  lines.push("");

  lines.push("## Implemented now");
  lines.push("");
  lines.push(
    renderTable({
      rows: implementedNow,
      includeDecision: false,
      includeJustification: false,
    }),
  );
  lines.push("");

  lines.push("## Planned (not yet implemented)");
  lines.push("");

  const plannedHasNotes = planned.some((r) => (r.justification ?? "").trim().length > 0);
  lines.push(
    renderTable({
      rows: planned,
      includeDecision: false,
      includeJustification: plannedHasNotes,
    }),
  );
  lines.push("");

  lines.push("## Excluded");
  lines.push("");

  const excludedHasNotes = excluded.some(
    (r) => (r.justification ?? "").trim().length > 0,
  );
  lines.push(
    renderTable({
      rows: excluded,
      includeDecision: false,
      includeJustification: excludedHasNotes,
    }),
  );

  return lines.join("\n");
}

function assertJsonCoversImplemented({ functions, implementedNormalized }) {
  const jsonNormalized = new Set(functions.map((f) => normalizeRoutineName(f.name)));
  const missing = [...implementedNormalized].filter((n) => !jsonNormalized.has(n));
  if (missing.length > 0) {
    throw new Error(
      `data/cspice-functions.json is missing ${missing.length} routines implemented by SpiceBackend: ${missing
        .sort()
        .join(", ")}`,
    );
  }
}

function assertNoExcludedImplemented({ functions, implementedNormalized }) {
  const bad = functions.filter(
    (f) =>
      f.decision === "excluded" && implementedNormalized.has(normalizeRoutineName(f.name)),
  );
  if (bad.length > 0) {
    throw new Error(
      `Found ${bad.length} routines marked excluded but implemented by SpiceBackend: ${bad
        .map((b) => b.name)
        .sort()
        .join(", ")}`,
    );
  }
}

async function readCspiceFunctionsJson() {
  const jsonText = await readFile(CSPICE_FUNCTIONS_JSON_PATH, "utf8");
  const functions = loadCspiceFunctionsJson(jsonText);
  functions.sort((a, b) => a.name.localeCompare(b.name));
  return functions;
}

async function refreshJsonFromNaif() {
  const html = await fetchCspiceIndex();
  const naifRoutines = parseCspiceIndexHtml(html);

  let existing = [];
  try {
    existing = await readCspiceFunctionsJson();
  } catch {
    // If missing, we'll create it.
    existing = [];
  }

  const merged = mergeCspiceFunctionsFromNaif({ existing, naifRoutines });

  await mkdir(path.dirname(CSPICE_FUNCTIONS_JSON_PATH), { recursive: true });
  await writeFile(CSPICE_FUNCTIONS_JSON_PATH, formatJson(merged), "utf8");

  return { naifRoutines, merged };
}

async function checkJsonDriftAgainstNaif() {
  const html = await fetchCspiceIndex();
  const naifRoutines = parseCspiceIndexHtml(html);
  const functions = await readCspiceFunctionsJson();

  const byNameNaif = new Map(naifRoutines.map((r) => [r.name, r]));
  const byNameJson = new Map(functions.map((r) => [r.name, r]));

  const missingInJson = naifRoutines
    .filter((r) => !byNameJson.has(r.name))
    .map((r) => r.name);
  const extraInJson = functions
    .filter((r) => !byNameNaif.has(r.name))
    .map((r) => r.name);
  const purposeDrift = naifRoutines
    .filter((r) => byNameJson.has(r.name) && byNameJson.get(r.name).purpose !== r.purpose)
    .map((r) => r.name);

  if (missingInJson.length || extraInJson.length || purposeDrift.length) {
    const parts = ["CSPICE inventory drift detected:"];
    if (missingInJson.length) {
      parts.push(
        `- Missing in JSON: ${missingInJson.length} (${missingInJson.sort().join(", ")})`,
      );
    }
    if (extraInJson.length) {
      parts.push(
        `- Extra in JSON (not in NAIF index): ${extraInJson.length} (${extraInJson.sort().join(", ")})`,
      );
    }
    if (purposeDrift.length) {
      parts.push(
        `- Purpose drift vs NAIF index: ${purposeDrift.length} (${purposeDrift.sort().join(", ")})`,
      );
    }
    parts.push("");
    parts.push("Run: node scripts/generate-cspice-inventory.mjs --refresh-from-naif");
    throw new Error(parts.join("\n"));
  }

  process.stdout.write("OK: data/cspice-functions.json matches NAIF index.\n");
}

async function main() {
  const { refreshFromNaif, check } = parseArgs(process.argv.slice(2));

  if (check) {
    await checkJsonDriftAgainstNaif();
    return;
  }

  if (refreshFromNaif) {
    await refreshJsonFromNaif();
  }

  const functions = await readCspiceFunctionsJson();
  const { normalized: implementedNormalized, extendsNames } =
    await collectImplementedRoutineNamesFromSpiceBackend();

  assertJsonCoversImplemented({ functions, implementedNormalized });
  assertNoExcludedImplemented({ functions, implementedNormalized });

  const markdown = renderMarkdown({ functions, implementedNormalized, extendsNames });
  await writeFile(OUTPUT_PATH, markdown + "\n", "utf8");

  const total = functions.length;
  const implementedCount = functions.filter((r) =>
    implementedNormalized.has(normalizeRoutineName(r.name)),
  ).length;

  process.stdout.write(
    `Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)} (routines: ${total}, implemented now: ${implementedCount}).\n`,
  );
}

await main();
