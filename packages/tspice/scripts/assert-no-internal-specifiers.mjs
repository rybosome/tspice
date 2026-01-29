import fs from "node:fs";
import path from "node:path";

function walkFiles(rootDir) {
  /** @type {string[]} */
  const out = [];

  /** @param {string} dir */
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // Defensive: dist-publish should not contain these, but don't traverse if it does.
      if (entry.name === "node_modules" || entry.name === ".git") continue;

      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        out.push(abs);
      }
    }
  }

  walk(rootDir);
  return out;
}

function isTextFileToScan(absPath) {
  const ext = path.extname(absPath);
  // Keep this narrow to avoid false positives in licenses / large binaries,
  // while still covering published docs like README.md.
  return (
    ext === ".js" ||
    ext === ".mjs" ||
    ext === ".cjs" ||
    ext === ".ts" ||
    ext === ".d.ts" ||
    ext === ".json" ||
    ext === ".md"
  );
}

function indexToLineCol(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  const line = lines.length;
  const col = lines.at(-1)?.length ?? 0;
  return { line, col: col + 1 };
}

export function assertNoInternalWorkspaceSpecifiers({ rootDir, forbidden } = {}) {
  if (!rootDir) {
    throw new Error("assertNoInternalWorkspaceSpecifiers: missing rootDir");
  }

  const forbiddenSpecifiers =
    forbidden ??
    /** @type {const} */ ([
      { kind: "exact", value: "@rybosome/tspice-core" },
      { kind: "prefix", value: "@rybosome/tspice-backend-" },
    ]);

  /** @type {{file: string; specifier: string; line: number; col: number}[]} */
  const hits = [];

  for (const absPath of walkFiles(rootDir)) {
    if (!isTextFileToScan(absPath)) continue;

    let text;
    try {
      text = fs.readFileSync(absPath, "utf8");
    } catch {
      // Skip unreadable/non-text files.
      continue;
    }

    for (const spec of forbiddenSpecifiers) {
      const needle = spec.value;
      let idx = text.indexOf(needle);
      while (idx !== -1) {
        if (spec.kind === "exact" || spec.kind === "prefix") {
          const { line, col } = indexToLineCol(text, idx);
          hits.push({
            file: path.relative(rootDir, absPath),
            specifier: needle,
            line,
            col,
          });
        }
        idx = text.indexOf(needle, idx + needle.length);
      }
    }
  }

  if (hits.length) {
    const header = `dist-publish still contains internal workspace specifiers (root: ${rootDir})`;
    const details = hits
      .slice(0, 50)
      .map((h) => `- ${h.file}:${h.line}:${h.col} contains ${JSON.stringify(h.specifier)}`)
      .join("\n");

    const suffix =
      hits.length > 50 ? `\n...and ${hits.length - 50} more` : "";

    throw new Error(`${header}\n${details}${suffix}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = process.argv[2];
  if (!rootDir) {
    throw new Error(
      "Usage: node ./scripts/assert-no-internal-specifiers.mjs <dist-publish-root>",
    );
  }
  assertNoInternalWorkspaceSpecifiers({ rootDir });
}
