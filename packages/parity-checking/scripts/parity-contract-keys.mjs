import * as fs from "node:fs";
import * as path from "node:path";

import * as ts from "typescript";

/**
* Stable, deterministic comparator for strings.
*
* Note: we intentionally avoid locale-dependent sorting.
*/
export function stableCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    throw new TypeError(
      `stableCompare expects (string, string), got (${typeof a}, ${typeof b})`,
    );
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function readSourceFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function getExportedInterface(sourceFile, interfaceName) {
  for (const stmt of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text !== interfaceName) continue;

    const isExported = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0;
    if (!isExported) continue;

    return stmt;
  }

  return null;
}

/**
* Extract the list of `*Api` interfaces that compose `SpiceBackend`.
*
* We keep this intentionally strict so contract changes fail loudly.
*/
export function extractSpiceBackendApis(indexSourceFile) {
  for (const stmt of indexSourceFile.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text !== "SpiceBackend") continue;

    const extendsClause = stmt.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword);
    if (!extendsClause) {
      throw new Error("SpiceBackend has no extends clause (unexpected)");
    }

    const apiNames = [];
    for (const t of extendsClause.types) {
      const expr = t.expression;
      if (!ts.isIdentifier(expr)) {
        throw new Error(
          `Unsupported SpiceBackend extends type (expected identifier): ${expr.getText(indexSourceFile)}`,
        );
      }

      const name = expr.text;
      if (!name.endsWith("Api")) {
        throw new Error(
          `SpiceBackend extends ${name}, which does not end with "Api". ` +
            "Update parity contract key extraction if this is intentional.",
        );
      }
      apiNames.push(name);
    }

    // Determinism + guard against accidental duplication.
    const uniq = Array.from(new Set(apiNames));
    if (uniq.length !== apiNames.length) {
      throw new Error("SpiceBackend extends list must not contain duplicates.");
    }
    return uniq.sort(stableCompare);
  }

  throw new Error("Could not find interface SpiceBackend in backend-contract/src/index.ts");
}

function kebabCaseFromPascalCase(input) {
  // Handles typical PascalCase as well as acronym boundaries (e.g. HTTPServer).
  return input
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/**
* Compute the stable "domain" portion of a parity call key from an `*Api` name.
*
* This is intentionally derived from the interface name (not the filename), so
* contract file re-orgs/renames don't implicitly change parity scenario keys.
*/
export function domainFromApiName(apiName) {
  if (typeof apiName !== "string") {
    throw new TypeError(`domainFromApiName expects string, got ${typeof apiName}`);
  }
  if (!apiName.endsWith("Api")) {
    throw new Error(`Expected an \"*Api\" name, got: ${apiName}`);
  }
  return kebabCaseFromPascalCase(apiName.slice(0, -"Api".length));
}

export function computeContractKeys({ indexPath, domainsDir }) {
  const indexSf = readSourceFile(indexPath);
  const apiNames = extractSpiceBackendApis(indexSf);

  const domainFiles = fs
    .readdirSync(domainsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort(stableCompare)
    .map((f) => path.join(domainsDir, f));

  // Map `ExportedInterfaceName` -> { filePath, iface }
  const exportedInterfaces = new Map();
  for (const filePath of domainFiles) {
    const sf = readSourceFile(filePath);

    for (const stmt of sf.statements) {
      if (!ts.isInterfaceDeclaration(stmt)) continue;
      const isExported = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0;
      if (!isExported) continue;

      const name = stmt.name.text;
      if (exportedInterfaces.has(name)) {
        const prev = exportedInterfaces.get(name);
        throw new Error(
          `Duplicate exported interface ${name} found in both ${prev.filePath} and ${filePath}`,
        );
      }
      exportedInterfaces.set(name, { filePath, iface: stmt });
    }
  }

  const keys = [];

  for (const apiName of apiNames) {
    const entry = exportedInterfaces.get(apiName);
    if (!entry) {
      throw new Error(
        `Could not locate exported interface ${apiName} in backend-contract/src/domains/*.ts`,
      );
    }

    const domain = domainFromApiName(apiName);

    const methodNames = new Set();
    for (const member of entry.iface.members) {
      if (!ts.isMethodSignature(member)) continue;

      // Ignore overloads by de-duping on name.
      const name = member.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        methodNames.add(name.text);
      } else {
        throw new Error(
          `Unsupported method name kind while parsing ${apiName} in ${entry.filePath}: ${ts.SyntaxKind[name.kind]}`,
        );
      }
    }

    for (const methodName of Array.from(methodNames).sort(stableCompare)) {
      keys.push(`${domain}.${methodName}`);
    }
  }

  // Determinism + guard against accidental duplication.
  return Array.from(new Set(keys)).sort(stableCompare);
}
