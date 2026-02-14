import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRequire } from "node:module";

const ts = (() => {
  const tryRequire = (fromUrl) => {
    try {
      return createRequire(fromUrl)("typescript");
    } catch (err) {
      const code = err && typeof err === "object" ? err.code : undefined;
      if (code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND") {
        return null;
      }
      throw err;
    }
  };

  return (
    tryRequire(import.meta.url) ??
    tryRequire(new URL("../../packages/tspice/package.json", import.meta.url)) ??
    (() => {
      throw new Error(
        "[generate:llm] Missing dependency: typescript. Install generator deps (e.g. `pnpm install --filter @rybosome/tspice...`).",
      );
    })()
  );
})();

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readTextFile(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : text + "\n";
}

function writeTextFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, ensureTrailingNewline(content), "utf8");
}

function writeJsonFile(absPath, value) {
  const json = JSON.stringify(value, null, 2);
  writeTextFile(absPath, json);
}

function sortUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function createTypeScriptSourceFile({ fileName, sourceText }) {
  return ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );
}

function hasModifier(node, modifierKind) {
  return Boolean(node.modifiers?.some((m) => m.kind === modifierKind));
}

function extractNamedExports(indexTsSource) {
  const sourceFile = createTypeScriptSourceFile({
    fileName: "packages/tspice/src/index.ts",
    sourceText: indexTsSource,
  });

  /** @type {Set<string>} */
  const typeExports = new Set();
  /** @type {Set<string>} */
  const valueExports = new Set();

  const add = (name, isTypeOnly) => {
    if (!name) return;
    (isTypeOnly ? typeExports : valueExports).add(name);
  };

  for (const stmt of sourceFile.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const clause = stmt.exportClause;

      // `export * from "..."` or `export * as ns from "..."`.
      if (!clause) {
        throw new Error(
          `[generate:llm] Unsupported star export in packages/tspice/src/index.ts: ${stmt.getText(sourceFile)}. ` +
            `Use explicit named exports or extend tools/llm/generate.mjs to expand star exports so the public surface can't go incomplete silently.`,
        );
      }

      if (ts.isNamedExports(clause)) {
        for (const el of clause.elements) {
          add(el.name.text, Boolean(stmt.isTypeOnly || el.isTypeOnly));
        }
        continue;
      }

      if (ts.isNamespaceExport(clause)) {
        // `export * as ns from "...";`
        add(clause.name.text, Boolean(stmt.isTypeOnly));
        continue;
      }

      throw new Error(
        `[generate:llm] Unsupported exportClause kind in packages/tspice/src/index.ts: ${ts.SyntaxKind[clause.kind]}`,
      );
    }

    if (ts.isExportAssignment(stmt)) {
      throw new Error(
        `[generate:llm] Unsupported export assignment in packages/tspice/src/index.ts: ${stmt.getText(sourceFile)}. ` +
          `This generator currently supports only named exports.`,
      );
    }

    // Direct exported declarations (not currently used, but supported).
    if (!hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      continue;
    }

    if (hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) {
      throw new Error(
        `[generate:llm] Unsupported default export in packages/tspice/src/index.ts: ${stmt.getText(sourceFile)}. ` +
          `This generator currently supports only named exports.`,
      );
    }

    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) {
      add(stmt.name.text, true);
      continue;
    }

    if (ts.isEnumDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isFunctionDeclaration(stmt)) {
      invariant(stmt.name, `[generate:llm] Missing name for exported declaration: ${stmt.getText(sourceFile)}`);
      add(stmt.name.text, false);
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) {
          throw new Error(
            `[generate:llm] Unsupported exported variable pattern in packages/tspice/src/index.ts: ${decl.getText(sourceFile)}`,
          );
        }
        add(decl.name.text, false);
      }
      continue;
    }

    throw new Error(
      `[generate:llm] Unsupported exported statement kind in packages/tspice/src/index.ts: ${ts.SyntaxKind[stmt.kind]} (${stmt.getText(sourceFile)})`,
    );
  }

  return {
    typeExports: sortUnique([...typeExports]),
    valueExports: sortUnique([...valueExports]),
  };
}

function extractKernelSourceTypeDefinition(sharedTypesTsSource) {
  const sourceFile = createTypeScriptSourceFile({
    fileName: "packages/backend-contract/src/shared/types.ts",
    sourceText: sharedTypesTsSource,
  });

  /** @type {import('typescript').TypeAliasDeclaration[]} */
  const matches = [];
  for (const stmt of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === "KernelSource") {
      matches.push(stmt);
    }
  }

  invariant(matches.length === 1, `Expected exactly one KernelSource type alias, found ${matches.length}`);

  const node = matches[0];
  invariant(
    hasModifier(node, ts.SyntaxKind.ExportKeyword),
    "KernelSource type alias must be exported from packages/backend-contract/src/shared/types.ts",
  );

  return node.getText(sourceFile);
}

function readExamples(exampleDirAbs, repoRootAbs) {
  invariant(fs.existsSync(exampleDirAbs), `Missing examples directory: ${path.relative(repoRootAbs, exampleDirAbs)}`);

  const entries = fs.readdirSync(exampleDirAbs, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  invariant(files.length > 0, `No .ts examples found in: ${path.relative(repoRootAbs, exampleDirAbs)}`);

  return files.map((name) => {
    const absPath = path.join(exampleDirAbs, name);
    const relPath = path.relative(repoRootAbs, absPath).replaceAll(path.sep, "/");
    const content = readTextFile(absPath).trimEnd();
    return { relPath, content };
  });
}

function buildLlmsTxt() {
  return `# tspice

TypeScript-first wrapper around NAIF SPICE (CSPICE).

Supported environments / backends:

- browser/WebWorker (WASM)
- Node.js (native addon)

This file (and its sibling artifacts) are generated by \`pnpm generate:llm\`.

## Artifacts

Hosted (GitHub Pages):

- https://rybosome.github.io/tspice/llms.txt
- https://rybosome.github.io/tspice/llms-full.txt
- https://rybosome.github.io/tspice/tspice.schema.json

Repo paths:

- \`apps/docs/public/llms-full.txt\` — full LLM-focused documentation + typechecked golden examples
- \`apps/docs/public/tspice.schema.json\` — structured JSON metadata summary for tools/LLMs

## Policies / disclosures (repo files)

- \`docs/cspice-policy.md\`
- \`docs/cspice-naif-disclosure.md\`
- \`THIRD_PARTY_NOTICES.md\`

## Non-goals / do not assume

- This repo does **not** ship SPICE kernels; callers must provide kernels (LSK/SPK/FK/etc) appropriate to their use case.
- Do not assume \`backend: "node"\` is available everywhere; it depends on a native addon (Node.js (native addon)). Prefer \`backend: "wasm"\` for browser/WebWorker (WASM) portability.
- Do not assume network access; kernel bytes may come from local files, fetch, or other sources.
`;
}
function buildLlmsFullTxt({ exports, kernelSourceType, examples }) {
  const exportSection = `## Public API surface (generated)\n\nSource: \`packages/tspice/src/index.ts\`\n\n### Value exports\n\n${exports.valueExports.map((n) => `- \`${n}\``).join("\n")}\n\n### Type exports\n\n${exports.typeExports.map((n) => `- \`${n}\``).join("\n")}\n`;

  const kernelSourceSection = `## KernelSource (generated)\n\nSource: \`packages/backend-contract/src/shared/types.ts\`\n\n\`\`\`ts\n${kernelSourceType}\n\`\`\`\n\nNotes:\n\n- \`KernelSource\` is accepted by \`spice.kit.loadKernel()\` and lower-level backend APIs like \`raw.furnsh()\`.\n- Passing an object form (\`{ path, bytes }\`) is the most portable approach across WASM + Node backends.\n`;

  const examplesSection = `## Golden examples (typechecked in CI)\n\nThese example files are committed and typechecked as part of the monorepo TypeScript build.\n\n${examples
    .map(
      (ex) =>
        `### \`${ex.relPath}\`\n\n\`\`\`ts\n${ex.content}\n\`\`\``,
    )
    .join("\n\n")}\n`;

  const policiesSection = `## Policies / disclosures\n\nThese are the canonical repo files:\n\n- \`docs/cspice-policy.md\`\n- \`docs/cspice-naif-disclosure.md\`\n- \`THIRD_PARTY_NOTICES.md\`\n`;

  const nonGoalsSection = `## Non-goals / do not assume\n\n- **No kernels included.** tspice does not bundle NAIF kernels; you must provide and load kernels explicitly.\n- **No implicit backend selection.** Choose \`backend: "wasm"\` or \`backend: "node"\`.\n- **No guarantee of native availability.** The Node backend requires a platform-specific native addon; WASM is the most portable default.\n- **No internet assumptions.** Some environments disallow network access; design your kernel-loading strategy accordingly.\n- **Not an orbital mechanics library.** tspice is a SPICE wrapper; higher-level mission logic is out of scope.\n`;

  const generatorSection = `## Regenerating these artifacts\n\nFrom the repo root:\n\n\`\`\`sh\npnpm generate:llm\n\`\`\`\n\nGenerated outputs:\n\n- \`llms.txt\`\n- \`apps/docs/public/llms.txt\`\n- \`apps/docs/public/llms-full.txt\`\n- \`apps/docs/public/tspice.schema.json\`\n`;

  return `# tspice — LLM/tool artifacts (full)\n\nThis document is intended for LLMs and tool builders. It describes the public surface area of \`@rybosome/tspice\`, key types, and includes typechecked examples.\n\n${exportSection}\n\n${kernelSourceSection}\n\n${examplesSection}\n\n${policiesSection}\n\n${nonGoalsSection}\n\n${generatorSection}`;
}

function buildTspiceSchemaSummary({ exports, kernelSourceType, examples }) {
  const exportValueDescriptions = {
    Mat3: "3×3 matrix helper for frame transforms and vector math.",
    J2000: "Constant frame name for the canonical inertial reference frame (J2000).",
    SpiceError: "Error thrown when underlying SPICE/CSPICE operations fail.",

    createBackend:
      "Create a low-level SPICE backend implementation (wasm or node) conforming to the backend contract.",
    createSpice:
      "Create a sync-ish tspice client (raw backend + higher-level kit helpers).",
    createSpiceAsync:
      "Create an async tspice client mirroring the sync surface area (all methods return Promises).",

    spiceClients:
      "Higher-level client builder that can produce in-process, async, or WebWorker clients and a dispose() lifecycle.",

    createPublicKernels:
      "Create a builder for assembling a small set of commonly-used public NAIF kernels (URLs + load paths).",
    publicKernels: "Preconfigured PublicKernelsBuilder with default options.",

    assertMat3ArrayLike9:
      "Runtime assertion that a value is a length-9 array-like suitable for a 3×3 matrix.",
    isMat3ArrayLike9:
      "Type guard that checks whether a value is a length-9 array-like suitable for a 3×3 matrix.",
    brandMat3ColMajor:
      "Type-brand a length-9 number array as Mat3ColMajor (column-major) without copying.",
    brandMat3RowMajor:
      "Type-brand a length-9 number array as Mat3RowMajor (row-major) without copying.",
    isBrandedMat3ColMajor:
      "Runtime predicate that checks whether a value is branded as Mat3ColMajor.",
    isBrandedMat3RowMajor:
      "Runtime predicate that checks whether a value is branded as Mat3RowMajor.",
  };

  const exportTypeDescriptions = {
    KernelSource:
      "Kernel identifier accepted by kit.loadKernel(): either a string path or an object with { path, bytes }.",
    SpiceBackend:
      "Low-level backend interface implemented by the WASM and Node.js backends.",

    Mat3ColMajor: "Branded type for a 3×3 matrix encoded in column-major order.",
    Mat3RowMajor: "Branded type for a 3×3 matrix encoded in row-major order.",

    CreateBackendOptions:
      "Options accepted by createBackend() (explicit backend selection + optional wasmUrl override).",

    AberrationCorrection:
      "Allowed aberration correction strings for state/position queries (e.g. 'NONE', 'LT', ...).",
    BodyRef: "Body identifier accepted by kit APIs (NAIF name string or numeric id).",
    FrameName: "SPICE frame name string (e.g. 'J2000', 'IAU_EARTH').",
    GetStateArgs: "Argument object for kit.getState() (target, observer, time, frame, aberration).",
    SpiceTime: "Seconds past J2000 (ET).",
    StateVector:
      "Structured result returned by kit.getState() (position, velocity, light time, and query metadata).",
    Vec3: "Readonly 3-vector tuple type.",
    Vec6: "Readonly 6-vector tuple type.",

    Spice: "Sync-ish client type: { raw, kit }.",
    SpiceSync: "Alias of Spice (sync-ish client).",
    SpiceAsync: "Async client type mirroring Spice; all methods return Promises.",
    SpiceKit: "High-level convenience API built on top of the raw backend.",

    CreateSpiceOptions:
      "Options accepted by createSpice(): backend selection + optional backendInstance override.",
    CreateSpiceAsyncOptions: "Alias of CreateSpiceOptions.",

    SpiceClientBuildResult:
      "Return type of spiceClients builders: { spice, dispose }. Dispose is idempotent + safe.",
    SpiceClientsBuilder:
      "Fluent builder for constructing spice clients (in-process sync/async or WebWorker), optionally with caching + kernels.",
    SpiceClientsWebWorkerOptions:
      "Options for spiceClients.toWebWorker() (custom Worker, wasmUrl override, timeouts, termination behavior).",

    CreatePublicKernelsOptions:
      "Options accepted by createPublicKernels() (urlBase + pathBase).",
    PublicKernelId:
      "Union of built-in public kernel ids (e.g. naif0012_tls, pck00011_tpc, de432s_bsp).",
    PublicKernelsBuilder:
      "Builder for selecting public kernels and producing a KernelPack.",

    KernelPack:
      "A small ordered set of kernels (URLs + load paths) intended to be fetched and loaded as a group.",
    KernelPackKernel:
      "A single kernel entry in a KernelPack: { url, path }.",
    LoadKernelPackOptions:
      "Options for kernelPack.loadKernelPack() (baseUrl behavior, fetch override, and fetch strategy).",
  };

  const exampleDescriptionsByPath = {
    "packages/tspice/test/llm-examples/backend-env-selection.example.ts":
      "Backend selection (Node vs WASM) + spiceClients lifecycle/dispose.",
    "packages/tspice/test/llm-examples/kernel-loading.example.ts":
      "Kernel loading patterns via KernelSource (filesystem path vs bytes).",
    "packages/tspice/test/llm-examples/state-and-frame-transform.example.ts":
      "Ephemeris state query (getState) + frame transform (frameTransform) + Mat3 usage.",
    "packages/tspice/test/llm-examples/time-conversion.example.ts": "UTC ↔ ET time conversions.",
  };

  const toExportEntries = (names, descriptions) =>
    names.map((name) => ({
      name,
      description: descriptions[name] ?? "Public export from @rybosome/tspice.",
    }));

  const goldenExamples = examples.map((ex) => ({
    repoPath: ex.relPath,
    description:
      exampleDescriptionsByPath[ex.relPath] ?? "Golden TypeScript example (typechecked in CI).",
  }));

  return {
    format: "tspice.schema.json",
    intent: "Structured JSON metadata summary for LLMs and tool/integration builders.",

    hostedUrls: {
      llmsTxt: "https://rybosome.github.io/tspice/llms.txt",
      llmsFullTxt: "https://rybosome.github.io/tspice/llms-full.txt",
      tspiceSchemaJson: "https://rybosome.github.io/tspice/tspice.schema.json",
    },

    environments: [
      {
        id: "wasm",
        name: "browser/WebWorker (WASM)",
        constraints: [
          "Portable default; works in browsers and other WASM-capable runtimes.",
          "No direct OS filesystem access; prefer loading kernels via bytes (KernelSource { path, bytes }).",
          "Large kernels can be memory-heavy; consider fetchStrategy='sequential' when loading packs.",
        ],
      },
      {
        id: "node",
        name: "Node.js (native addon)",
        constraints: [
          "Requires an optional, platform-specific native addon package.",
          "Can load kernels by OS filesystem path (KernelSource string) or via bytes.",
        ],
      },
    ],

    kernelSource: {
      sourceFile: "packages/backend-contract/src/shared/types.ts",
      typeScriptDefinition: kernelSourceType,
      notesByEnvironment: {
        wasm: [
          "Prefer the object form: { path, bytes }.",
          "String paths are backend-defined and generally refer to the WASM virtual filesystem, not the OS filesystem.",
        ],
        node: [
          "String form is typically treated as an OS filesystem path passed to the native backend's furnsh().",
          "The object form { path, bytes } is supported and is the most portable across environments.",
        ],
      },
    },

    exports: {
      sourceFile: "packages/tspice/src/index.ts",
      valueExports: toExportEntries(exports.valueExports, exportValueDescriptions),
      typeExports: toExportEntries(exports.typeExports, exportTypeDescriptions),
    },

    goldenExamples,

    policiesAndDisclosures: [
      {
        repoPath: "docs/cspice-policy.md",
        description: "Project policy for CSPICE usage and redistribution constraints.",
      },
      {
        repoPath: "docs/cspice-naif-disclosure.md",
        description: "NAIF/CSPICE disclosure guidance.",
      },
      {
        repoPath: "THIRD_PARTY_NOTICES.md",
        description: "Third-party notices and attributions.",
      },
    ],

    nonGoals: [
      "tspice does not bundle NAIF kernels; callers must provide and load kernels explicitly.",
      "Do not assume backend='node' works in all environments; it requires a Node.js native addon.",
      "Do not assume network access is available; design kernel loading accordingly.",
      "This file is metadata, not a complete spec for SPICE behavior; consult NAIF docs for SPICE semantics.",
    ],

    generatedBy: {
      script: "tools/llm/generate.mjs",
      command: "pnpm generate:llm",
      outputFile: "apps/docs/public/tspice.schema.json",
    },
  };
}
function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const repoRoot = path.resolve(scriptDir, "../..");

  const tspiceIndexAbs = path.join(repoRoot, "packages/tspice/src/index.ts");
  const backendContractTypesAbs = path.join(
    repoRoot,
    "packages/backend-contract/src/shared/types.ts",
  );

  const exports = extractNamedExports(readTextFile(tspiceIndexAbs));
  const kernelSourceType = extractKernelSourceTypeDefinition(readTextFile(backendContractTypesAbs));

  const examplesDirAbs = path.join(repoRoot, "packages/tspice/test/llm-examples");
  const examples = readExamples(examplesDirAbs, repoRoot);

  const llmsTxt = buildLlmsTxt();
  const llmsFull = buildLlmsFullTxt({ exports, kernelSourceType, examples });
  const schema = buildTspiceSchemaSummary({ exports, kernelSourceType, examples });

  writeTextFile(path.join(repoRoot, "llms.txt"), llmsTxt);
  writeTextFile(path.join(repoRoot, "apps/docs/public/llms.txt"), llmsTxt);
  writeTextFile(path.join(repoRoot, "apps/docs/public/llms-full.txt"), llmsFull);
  writeJsonFile(path.join(repoRoot, "apps/docs/public/tspice.schema.json"), schema);

  console.log("[generate:llm] wrote llms.txt + apps/docs/public/{llms.txt,llms-full.txt,tspice.schema.json}");
}

main();
