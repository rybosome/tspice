import * as ts from "typescript";

import { isWithinRepoRoot, toRepoRelativePath } from "./pathUtils.js";
import type { ExportedCallableTarget, ExportedSymbolInfo, SourceLocation } from "./types.js";

function resolveAliasedSymbol(checker: ts.TypeChecker, sym: ts.Symbol): ts.Symbol {
  let current = sym;
  // In practice the alias chain is shallow, but this keeps behavior predictable.
  for (let i = 0; i < 10; i++) {
    if (!(current.flags & ts.SymbolFlags.Alias)) return current;
    const next = checker.getAliasedSymbol(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function pickBestDeclaration(sym: ts.Symbol): ts.Declaration | undefined {
  // Prefer the value declaration when available.
  if (sym.valueDeclaration) return sym.valueDeclaration;

  // Otherwise pick the first declaration (for types).
  return sym.declarations?.[0];
}

function getNodeStartForLocation(node: ts.Declaration, sf: ts.SourceFile): number {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.name ? node.name.getStart(sf) : node.getStart(sf);
  }

  if (ts.isVariableDeclaration(node)) {
    return node.name.getStart(sf);
  }

  return node.getStart(sf);
}

function tryGetSourceLocation(opts: { repoRoot: string; node: ts.Declaration }): SourceLocation | undefined {
  const sf = opts.node.getSourceFile();
  const absPath = sf.fileName;

  if (!isWithinRepoRoot(opts.repoRoot, absPath)) return undefined;
  if (sf.isDeclarationFile) return undefined;

  const start = getNodeStartForLocation(opts.node, sf);
  const lc = sf.getLineAndCharacterOfPosition(start);

  return {
    filePath: toRepoRelativePath(opts.repoRoot, absPath),
    line: lc.line + 1,
    col: lc.character + 1
  };
}

function isCallableDeclaration(decl: ts.Declaration): boolean {
  if (ts.isFunctionDeclaration(decl)) return true;

  if (ts.isVariableDeclaration(decl)) {
    const init = decl.initializer;
    return !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
  }

  return false;
}

export function extractExportSurface(opts: {
  repoRoot: string;
  checker: ts.TypeChecker;
  entrypointSourceFiles: ts.SourceFile[];
}): {
  exportedSymbols: ExportedSymbolInfo[];
  exportedCallables: ExportedCallableTarget[];
} {
  const byExportName = new Map<string, { info: ExportedSymbolInfo; originalSymbol: ts.Symbol }>();

  for (const sf of opts.entrypointSourceFiles) {
    const moduleSym = opts.checker.getSymbolAtLocation(sf);
    if (!moduleSym) continue;

    const exports = opts.checker.getExportsOfModule(moduleSym);
    for (const exp of exports) {
      const exportName = exp.getName();
      const original = resolveAliasedSymbol(opts.checker, exp);
      const decl = pickBestDeclaration(original);

      const declaration = decl ? tryGetSourceLocation({ repoRoot: opts.repoRoot, node: decl }) : undefined;
      const isTypeOnly = !original.valueDeclaration;

      const info: ExportedSymbolInfo = {
        exportName,
        originalName: original.getName(),
        ...(declaration ? { declaration } : {}),
        isTypeOnly
      };

      const existing = byExportName.get(exportName);
      if (!existing) {
        byExportName.set(exportName, { info, originalSymbol: original });
        continue;
      }

      // Deterministic tie-breaker: prefer the one with the lexicographically earliest declaration
      // (or keep existing if both are missing).
      const a = existing.info.declaration;
      const b = info.declaration;
      if (!a || !b) continue;

      const keyA = `${a.filePath}:${a.line}:${a.col}:${existing.info.originalName}`;
      const keyB = `${b.filePath}:${b.line}:${b.col}:${info.originalName}`;
      if (keyB < keyA) {
        byExportName.set(exportName, { info, originalSymbol: original });
      }
    }
  }

  const exportedSymbols = [...byExportName.values()]
    .map((v) => v.info)
    .sort((a, b) => {
      if (a.exportName < b.exportName) return -1;
      if (a.exportName > b.exportName) return 1;

      const locA = a.declaration;
      const locB = b.declaration;
      const keyA = locA ? `${locA.filePath}:${locA.line}:${locA.col}` : "";
      const keyB = locB ? `${locB.filePath}:${locB.line}:${locB.col}` : "";
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;

      if (a.originalName < b.originalName) return -1;
      if (a.originalName > b.originalName) return 1;

      return Number(a.isTypeOnly) - Number(b.isTypeOnly);
    });

  const callables: ExportedCallableTarget[] = [];
  for (const { info, originalSymbol } of byExportName.values()) {
    const decl = pickBestDeclaration(originalSymbol);
    if (!decl) continue;
    if (!isCallableDeclaration(decl)) continue;

    const location = tryGetSourceLocation({ repoRoot: opts.repoRoot, node: decl });
    if (!location) continue;

    callables.push({
      exportName: info.exportName,
      originalName: info.originalName,
      callId: `exported-callable:${location.filePath}:${info.exportName}`,
      location
    });
  }

  const exportedCallables = callables
    .sort((a, b) => {
      const keyA = `${a.location.filePath}:${a.location.line}:${a.location.col}:${a.exportName}`;
      const keyB = `${b.location.filePath}:${b.location.line}:${b.location.col}:${b.exportName}`;
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });

  return { exportedSymbols, exportedCallables };
}
