import fs from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type AllowlistEntry = {
  member: string;
  rationale: string;
};

type CspiceInventoryEntry = {
  name: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const contractSrcDir = path.join(repoRoot, "packages/backend-contract/src");
const backendContractIndexPath = path.join(contractSrcDir, "index.ts");
const allowlistPath = path.join(
  repoRoot,
  "packages/backend-contract/config/spicebackend-cspice-allowlist.json",
);
const cspiceInventoryPath = path.join(repoRoot, "data/cspice-functions.json");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(abs));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(abs);
    }
  }
  return out.sort();
}

function readSourceFile(absPath: string): ts.SourceFile {
  const text = fs.readFileSync(absPath, "utf8");
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function isExported(node: ts.Node): boolean {
  return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
}

function getNamedExportedInterfaces(dir: string): Map<string, ts.InterfaceDeclaration> {
  const map = new Map<string, ts.InterfaceDeclaration>();

  for (const file of walkTsFiles(dir)) {
    const sf = readSourceFile(file);
    for (const stmt of sf.statements) {
      if (!ts.isInterfaceDeclaration(stmt)) continue;
      if (!isExported(stmt)) continue;
      map.set(stmt.name.text, stmt);
    }
  }

  return map;
}

function getSpiceBackendInterface(): ts.InterfaceDeclaration {
  const sf = readSourceFile(backendContractIndexPath);
  for (const stmt of sf.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) continue;
    if (stmt.name.text === "SpiceBackend") return stmt;
  }
  throw new Error("SpiceBackend interface not found in packages/backend-contract/src/index.ts");
}

function interfaceMemberNames(iface: ts.InterfaceDeclaration): string[] {
  const names = new Set<string>();

  for (const member of iface.members) {
    if (!(ts.isMethodSignature(member) || ts.isPropertySignature(member))) continue;
    const name = member.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      names.add(name.text);
      continue;
    }
    throw new Error(
      `Unsupported SpiceBackend member name syntax in ${iface.name.text}: ${ts.SyntaxKind[name.kind]}`,
    );
  }

  return [...names].sort();
}

function collectSpiceBackendMembers(): string[] {
  const backend = getSpiceBackendInterface();
  const interfaces = getNamedExportedInterfaces(path.join(contractSrcDir, "domains"));
  const members = new Set<string>();

  // Include any direct members declared on SpiceBackend (should be none after `.kind` move).
  for (const name of interfaceMemberNames(backend)) members.add(name);

  const extendsClause = backend.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
  if (!extendsClause) {
    throw new Error("SpiceBackend must extend domain `*Api` interfaces");
  }

  for (const baseType of extendsClause.types) {
    const expr = baseType.expression;
    if (!ts.isIdentifier(expr)) {
      throw new Error(`Unsupported SpiceBackend heritage type syntax: ${expr.getText()}`);
    }
    const apiName = expr.text;
    const iface = interfaces.get(apiName);
    if (!iface) {
      throw new Error(`Missing interface declaration for SpiceBackend base ${apiName}`);
    }
    for (const name of interfaceMemberNames(iface)) members.add(name);
  }

  return [...members].sort();
}

function readJson<T>(absPath: string): T {
  return JSON.parse(fs.readFileSync(absPath, "utf8")) as T;
}

function readAllowlist(): AllowlistEntry[] {
  const data = readJson<unknown>(allowlistPath);
  if (!Array.isArray(data)) {
    throw new Error("backend-contract allowlist must be a JSON array");
  }

  const entries: AllowlistEntry[] = data.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`allowlist[${i}] must be an object`);
    }
    const rec = entry as Record<string, unknown>;
    if (typeof rec.member !== "string" || rec.member.trim() === "") {
      throw new Error(`allowlist[${i}].member must be a non-empty string`);
    }
    if (typeof rec.rationale !== "string" || rec.rationale.trim() === "") {
      throw new Error(`allowlist[${i}].rationale must be a non-empty string`);
    }
    return { member: rec.member, rationale: rec.rationale };
  });

  return entries;
}

function readCspiceInventoryNormalized(): Set<string> {
  const data = readJson<unknown>(cspiceInventoryPath);
  if (!Array.isArray(data)) {
    throw new Error("data/cspice-functions.json must be a JSON array");
  }

  const normalized = new Set<string>();
  for (const [i, entry] of data.entries()) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`cspice inventory entry ${i} must be an object`);
    }
    const name = (entry as CspiceInventoryEntry).name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`cspice inventory entry ${i}.name must be a non-empty string`);
    }
    normalized.add(name.toLowerCase().replace(/_c$/, ""));
  }
  return normalized;
}

function collectContractOnlySourceViolations(): string[] {
  const violations: string[] = [];
  const disallowedNodeKinds = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.ClassExpression,
    ts.SyntaxKind.NewExpression,
    ts.SyntaxKind.CallExpression,
    ts.SyntaxKind.AwaitExpression,
    ts.SyntaxKind.YieldExpression,
  ]);

  const files = walkTsFiles(contractSrcDir);
  for (const absPath of files) {
    const sf = readSourceFile(absPath);
    const rel = path.relative(repoRoot, absPath);

    for (const stmt of sf.statements) {
      if (
        ts.isImportDeclaration(stmt) ||
        ts.isExportDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt)
      ) {
        continue;
      }

      if (ts.isVariableStatement(stmt)) {
        const flags = ts.getCombinedNodeFlags(stmt.declarationList);
        if ((flags & ts.NodeFlags.Const) === 0) {
          violations.push(`${rel}: non-const variable statement`);
          continue;
        }
        const isDeclareConst = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false;
        for (const decl of stmt.declarationList.declarations) {
          if (!decl.initializer) {
            if (isDeclareConst) continue;
            violations.push(`${rel}: const declaration without initializer`);
            continue;
          }
          const checkNode = (node: ts.Node): void => {
            if (disallowedNodeKinds.has(node.kind)) {
              const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
              violations.push(
                `${rel}:${line + 1}:${character + 1} disallowed runtime node ${ts.SyntaxKind[node.kind]}`,
              );
              return;
            }
            ts.forEachChild(node, checkNode);
          };
          checkNode(decl.initializer);
        }
        continue;
      }

      violations.push(`${rel}: disallowed top-level statement ${ts.SyntaxKind[stmt.kind]}`);
    }
  }

  return violations.sort();
}

describe("@rybosome/tspice-backend-contract invariants", () => {
  it("exports constants-only runtime surface", async () => {
    const specifier = "@rybosome/tspice-backend-contract";
    const mod = await import(/* @vite-ignore */ specifier);

    const runtimeEntries = Object.entries(mod).sort(([a], [b]) => a.localeCompare(b));
    const runtimeKeys = runtimeEntries.map(([k]) => k);

    // Contract-only package may expose constants/declarations, but no helper runtime logic.
    expect(runtimeKeys).toEqual(["GETMSG_WHICH_VALUES", "SPICE_INT32_MAX", "SPICE_INT32_MIN"]);

    for (const [key, value] of runtimeEntries) {
      expect(typeof value, `export ${key} must not be a function`).not.toBe("function");
    }
  });

  it("contains declarations/constants only in src/ (no runtime helper logic)", () => {
    const violations = collectContractOnlySourceViolations();
    if (violations.length > 0) {
      throw new Error(
        `backend-contract must be contracts-only (types/interfaces/constants/declarations). Violations:\n- ${violations.join("\n- ")}`,
      );
    }
  });

  it("classifies every SpiceBackend member against CSPICE inventory or checked-in allowlist", () => {
    const members = collectSpiceBackendMembers();
    const inventory = readCspiceInventoryNormalized();
    const allowlist = readAllowlist();

    const allowlistMembers = new Set<string>();
    for (const entry of allowlist) {
      if (allowlistMembers.has(entry.member)) {
        throw new Error(`Duplicate allowlist entry for ${entry.member}`);
      }
      allowlistMembers.add(entry.member);
    }

    const sortedAllowlistMembers = [...allowlistMembers].sort();
    expect([...allowlistMembers]).toEqual(sortedAllowlistMembers);

    const unknownAllowlistEntries = [...allowlistMembers].filter((member) => !members.includes(member)).sort();
    if (unknownAllowlistEntries.length > 0) {
      throw new Error(
        `Allowlist contains entries that are not current SpiceBackend members:\n- ${unknownAllowlistEntries.join("\n- ")}`,
      );
    }

    const missingClassification = members.filter((member) => {
      const normalized = member.toLowerCase();
      return !inventory.has(normalized) && !allowlistMembers.has(member);
    });

    if (missingClassification.length > 0) {
      throw new Error(
        [
          "Every SpiceBackend member must map to CSPICE inventory (case-insensitive) or a checked-in allowlist entry with rationale.",
          "This check intentionally covers camelCase/non-lowercase names so helpers cannot bypass classification.",
          ...missingClassification.map((member) => `- ${member}`),
        ].join("\n"),
      );
    }
  });
});
